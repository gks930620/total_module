// 시퀀스 그리기 — 참가자와 메시지를 목록으로 편집하고, 그림은 즉시 다시 그린다.
//
// 캔버스 드래그를 안 쓰는 이유: 시퀀스는 좌표가 없다. 참가자의 순서와 메시지의 순서가
// 곧 배치라서, 목록에 줄을 더하고 위아래로 옮기는 편집이 더 정확하고 실수도 적다.
import { useState, useRef, useEffect } from "react";
import {
  createSeq, addParticipant, renameParticipant, moveParticipant, removeParticipant,
  addMessage, updateMessage, moveMessage, removeMessage,
  serializeSeq, deserializeSeq, toSequenceMermaid, toSequenceSvg,
  SEQ_LAYOUT, seqExtent, participantX,
} from "../../lib/canvas/sequence.js";
import { CopyButton } from "../CopyButton.jsx";

const STORAGE = "dtb.canvas.sequence";

export function SequenceEditor() {
  const [seq, setSeq] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        const r = deserializeSeq(saved);
        if (r.ok) return r.seq;
      }
    } catch { /* 저장 불가 환경 — 빈 문서로 */ }
    // 처음 온 사람이 빈 화면을 보지 않게 — 두 참가자와 한 메시지로 시작한다
    let s = createSeq();
    let a, b;
    [s, a] = addParticipant(s, "클라이언트");
    [s, b] = addParticipant(s, "서버");
    [s] = addMessage(s, { from: a, to: b, label: "요청", kind: "sync" });
    [s] = addMessage(s, { from: b, to: a, label: "응답", kind: "reply" });
    return s;
  });
  const fileRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE, serializeSeq(seq)); } catch { /* 조용히 통과 */ }
    }, 300);
    return () => clearTimeout(t);
  }, [seq]);

  const addP = () => setSeq((s) => addParticipant(s, `참가자${s.participants.length + 1}`)[0]);
  const addM = () => setSeq((s) => {
    if (s.participants.length === 0) return s;
    const a = s.participants[0].id;
    const b = (s.participants[1] ?? s.participants[0]).id;
    return addMessage(s, { from: a, to: b, label: "메시지", kind: "sync" })[0];
  });

  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  const saveSvg = () => download(new Blob([toSequenceSvg(seq)], { type: "image/svg+xml" }), "sequence.svg");
  const savePng = () => {
    const url = URL.createObjectURL(new Blob([toSequenceSvg(seq)], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => b && download(b, "sequence.png"), "image/png");
    };
    img.src = url;
  };
  const saveJson = () => download(new Blob([serializeSeq(seq)], { type: "application/json" }), "sequence.json");
  const loadJson = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = deserializeSeq(String(reader.result));
      if (!r.ok) { alert(r.reason); return; }
      setSeq(r.seq);
    };
    reader.readAsText(file);
  };

  const L = SEQ_LAYOUT;
  const { w, h } = seqExtent(seq);

  return (
    <div className="seq-editor">
      <div className="toolbar cv-toolbar">
        <button type="button" className="btn" onClick={addP}>+ 참가자</button>
        <button type="button" className="btn" onClick={addM} disabled={!seq.participants.length}>+ 메시지</button>
        <div className="toolbar-right">
          <button type="button" className="btn" onClick={saveSvg} disabled={!seq.participants.length}>SVG</button>
          <button type="button" className="btn" onClick={savePng} disabled={!seq.participants.length}>PNG</button>
          <CopyButton value={() => toSequenceMermaid(seq)} label="mermaid 복사" />
          <button type="button" className="btn" onClick={saveJson} disabled={!seq.participants.length}>저장</button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>불러오기</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden
            onChange={(e) => { loadJson(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className="btn ghost" onClick={() => setSeq(createSeq())} disabled={!seq.participants.length}>전체 지우기</button>
        </div>
      </div>

      <div className="seq-body">
        <div className="seq-forms">
          <h3 className="seq-h">참가자 (왼쪽부터)</h3>
          {seq.participants.map((p, i) => (
            <div className="seq-row" key={p.id}>
              <input className="krw-input small" value={p.name} spellCheck={false}
                onChange={(e) => setSeq((s) => renameParticipant(s, p.id, e.target.value))} />
              <button type="button" className="btn icon" disabled={i === 0}
                onClick={() => setSeq((s) => moveParticipant(s, p.id, -1))}>←</button>
              <button type="button" className="btn icon" disabled={i === seq.participants.length - 1}
                onClick={() => setSeq((s) => moveParticipant(s, p.id, +1))}>→</button>
              <button type="button" className="btn icon" onClick={() => setSeq((s) => removeParticipant(s, p.id))}>✕</button>
            </div>
          ))}
          {!seq.participants.length && <p className="hint">'+ 참가자' 로 시작하세요.</p>}

          <h3 className="seq-h">메시지 (위에서 아래로 = 시간 순서)</h3>
          {seq.messages.map((m, i) => (
            <div className="seq-row msg" key={m.id}>
              <select value={m.from} onChange={(e) => setSeq((s) => updateMessage(s, m.id, { from: e.target.value }))}>
                {seq.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span className="seq-arrow-mark">→</span>
              <select value={m.to} onChange={(e) => setSeq((s) => updateMessage(s, m.id, { to: e.target.value }))}>
                {seq.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="krw-input small grow" value={m.label} spellCheck={false} placeholder="무엇을 보내나"
                onChange={(e) => setSeq((s) => updateMessage(s, m.id, { label: e.target.value }))} />
              <select value={m.kind} onChange={(e) => setSeq((s) => updateMessage(s, m.id, { kind: e.target.value }))}>
                <option value="sync">요청 —▶</option>
                <option value="reply">응답 ┄▶</option>
              </select>
              <button type="button" className="btn icon" disabled={i === 0}
                onClick={() => setSeq((s) => moveMessage(s, m.id, -1))}>↑</button>
              <button type="button" className="btn icon" disabled={i === seq.messages.length - 1}
                onClick={() => setSeq((s) => moveMessage(s, m.id, +1))}>↓</button>
              <button type="button" className="btn icon" onClick={() => setSeq((s) => removeMessage(s, m.id))}>✕</button>
            </div>
          ))}
        </div>

        {/* 미리보기 — 내보내기와 같은 배치 상수를 쓰므로 저장한 파일과 똑같다 */}
        <div className="seq-preview">
          <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, maxWidth: "100%" }}>
            {seq.participants.map((p) => {
              const cx = participantX(seq, p.id);
              return (
                <g key={p.id}>
                  <line x1={cx} y1={L.top + L.headH} x2={cx} y2={h - 16} className="seq-lifeline" />
                  <rect x={cx - L.headW / 2} y={L.top} width={L.headW} height={L.headH} rx={12} className="seq-head" />
                  <text x={cx} y={L.top + L.headH / 2 + 4} textAnchor="middle" className="seq-name">{p.name}</text>
                </g>
              );
            })}
            {seq.messages.map((m, i) => {
              const y = L.firstRow + i * L.rowH;
              const dash = m.kind === "reply" ? "6 5" : undefined;
              if (m.from === m.to) {
                const x = participantX(seq, m.from);
                return (
                  <g key={m.id}>
                    <path d={`M ${x} ${y - 8} H ${x + 44} V ${y + 12} H ${x + 8}`} className="seq-line" strokeDasharray={dash} fill="none" />
                    <polygon points={`${x + 8},${y + 12} ${x + 18},${y + 7} ${x + 18},${y + 17}`} className="seq-arrow" />
                    <text x={x + 52} y={y + 2} className="seq-label">{m.label}</text>
                  </g>
                );
              }
              const x1 = participantX(seq, m.from);
              const x2 = participantX(seq, m.to);
              const dir = x2 > x1 ? 1 : -1;
              return (
                <g key={m.id}>
                  <line x1={x1} y1={y} x2={x2 - dir * 4} y2={y} className="seq-line" strokeDasharray={dash} />
                  <polygon points={`${x2},${y} ${x2 - dir * 11},${y - 5} ${x2 - dir * 11},${y + 5}`} className="seq-arrow" />
                  <text x={(x1 + x2) / 2} y={y - 7} textAnchor="middle" className="seq-label halo">{m.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <p className="hint cv-hint">
        메시지의 위아래 순서가 곧 시간 순서입니다 · 그림은 이 브라우저에 자동 저장됩니다.
      </p>
    </div>
  );
}
