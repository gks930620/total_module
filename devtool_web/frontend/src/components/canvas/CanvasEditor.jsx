// 상자-화살표 그리기 편집기 — ERD·클래스·순서도·상태도가 함께 쓴다.
//
// draw.io 를 다 만들지 않는다. 초보 개발자가 프로젝트 문서에 넣을 그림에 필요한 것만:
// 상자 놓기 · 드래그로 옮기기 · 점에서 끌어 연결 · 내용 고치기 · 실행취소 · 저장.
//
// 상태는 model.js 의 문서 객체 하나다. 모든 조작이 "문서 → 새 문서" 라서
// 실행취소는 이전 문서를 쌓아 두는 것으로 끝난다(past/future 두 더미).
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  createDoc, addNode, moveNode, updateNode, removeNodes,
  addEdge, updateEdge, removeEdge, nodeSize, autoLayout,
  serialize, deserialize, toMermaidText, parseErFieldLine,
} from "../../lib/canvas/model.js";
import { shapePrimitives, edgeGeometry } from "../../lib/canvas/geometry.js";
import { toSvgString } from "../../lib/canvas/exportSvg.js";
import { CopyButton } from "../CopyButton.jsx";

// ── 도구 상자 — 종류마다 놓을 수 있는 상자가 다르다 ─────────────────

const PALETTE = {
  er: [
    { label: "테이블", make: () => ({ kind: "table", name: "새_테이블", fields: [{ name: "id", type: "BIGINT", pk: true, fk: false, unique: false, nullable: false }] }) },
  ],
  class: [
    { label: "클래스", make: () => ({ kind: "class", name: "NewClass", stereo: "class", fields: ["- id: Long"], methods: [] }) },
    { label: "인터페이스", make: () => ({ kind: "class", name: "NewInterface", stereo: "interface", fields: [], methods: ["+ run(): void"] }) },
    { label: "enum", make: () => ({ kind: "class", name: "Status", stereo: "enum", fields: ["READY", "DONE"], methods: [] }) },
  ],
  flowchart: [
    { label: "시작", make: () => ({ kind: "start", label: "시작" }) },
    { label: "처리", make: () => ({ kind: "step", label: "처리" }) },
    { label: "조건", make: () => ({ kind: "decision", label: "조건?" }) },
    { label: "DB", make: () => ({ kind: "db", label: "DB" }) },
    { label: "끝", make: () => ({ kind: "end", label: "끝" }) },
  ],
  state: [
    { label: "시작점", make: () => ({ kind: "initial" }) },
    { label: "상태", make: () => ({ kind: "state", label: "상태" }) },
    { label: "끝점", make: () => ({ kind: "final" }) },
  ],
};

/** 새 간선의 기본값 — ER 은 1:N 이 압도적으로 흔하다 */
const edgeDefaults = (type) => (type === "er" ? { fromCard: "1", toCard: "N" } : {});

// 원시 도형의 색 역할 → CSS 토큰. 내보내기(exportSvg)와 역할 이름을 공유한다.
const FILL = {
  surface: "var(--surface)", soft: "var(--soft)", accent: "var(--point)",
  onAccent: "#fff", strong: "var(--muted2)", text: "var(--text)",
  muted: "var(--muted2)", accentText: "var(--point-dark)", border: "var(--cv-line)", none: "none",
};

function Prim({ p }) {
  const stroke = FILL[p.stroke ?? "none"];
  const common = { fill: FILL[p.fill ?? "none"], stroke, strokeWidth: p.stroke && p.stroke !== "none" ? 1.5 : 0 };
  switch (p.t) {
    case "rect": return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx ?? 0} {...common} />;
    case "circle": return <circle cx={p.cx} cy={p.cy} r={p.r} {...common} />;
    case "line": return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={stroke} strokeWidth={1.5} />;
    case "path": return <path d={p.d} {...common} />;
    case "text":
      return (
        <text x={p.x} y={p.y} fontSize={p.size ?? 12} fontWeight={p.bold ? 700 : 400}
          textAnchor={p.anchor} fill={FILL[p.fill ?? "text"]}
          fontFamily={p.mono ? "ui-monospace, Consolas, monospace" : undefined}>{p.text}</text>
      );
    default: return null;
  }
}

// ── 오른쪽 편집 패널 ────────────────────────────────────────────────

const fieldToLine = (f) =>
  `${f.name} ${f.type}${f.pk ? " PK" : ""}${f.fk ? " FK" : ""}${f.unique && !f.pk ? " UQ" : ""}${f.nullable === false && !f.pk ? " NN" : ""}`;

const linesOf = (arr) => (arr ?? []).join("\n");
const toLines = (text) => String(text).split("\n").map((s) => s.trim()).filter(Boolean);

/**
 * 줄 단위 편집 칸.
 *
 * 문서에서 파싱해 되그리는 컨트롤드 값으로는 **엔터를 칠 수가 없다** — 빈 줄이
 * 파싱에서 걸러져 즉시 지워진다. 그래서 화면에는 초안(draft)을 그대로 두고,
 * 문서에는 파싱 결과만 보낸다. 다른 상자를 고르면 부모가 key 를 바꿔 초안을 새로 잡는다.
 */
function LinesArea({ initial, rows, onLines, onFocus }) {
  const [draft, setDraft] = useState(initial);
  return (
    <textarea
      className="area code" rows={rows} spellCheck={false} value={draft} onFocus={onFocus}
      onChange={(e) => { setDraft(e.target.value); onLines(toLines(e.target.value)); }}
    />
  );
}

function EditPanel({ doc, sel, onNode, onEdge, onDelete, onFocusSnapshot }) {
  const node = sel?.kind === "node" ? doc.nodes.find((n) => n.id === sel.id) : null;
  const edge = sel?.kind === "edge" ? doc.edges.find((e) => e.id === sel.id) : null;
  if (!node && !edge) {
    return (
      <aside className="cv-panel">
        <p className="cv-panel-empty">상자나 화살표를 누르면<br />여기서 내용을 고칩니다.</p>
      </aside>
    );
  }

  return (
    <aside className="cv-panel" onKeyDown={(e) => e.stopPropagation()}>
      {node && node.kind === "table" && (
        <>
          <label className="field"><span>테이블 이름</span>
            <input className="krw-input small" spellCheck={false} onFocus={onFocusSnapshot} value={node.name} onChange={(e) => onNode({ name: e.target.value })} /></label>
          <label className="field"><span>필드 — 한 줄에 하나, 뒤에 PK · FK · UQ · NN</span>
            <LinesArea key={`${node.id}-f`} rows={7} onFocus={onFocusSnapshot}
              initial={linesOf((node.fields ?? []).map(fieldToLine))}
              onLines={(lines) => onNode({ fields: lines.map(parseErFieldLine) })} /></label>
        </>
      )}

      {node && node.kind === "class" && (
        <>
          <label className="field"><span>이름</span>
            <input className="krw-input small" spellCheck={false} onFocus={onFocusSnapshot} value={node.name} onChange={(e) => onNode({ name: e.target.value })} /></label>
          <label className="field"><span>종류</span>
            <select value={node.stereo ?? "class"} onFocus={onFocusSnapshot}
              onChange={(e) => onNode({ stereo: e.target.value })}>
              <option value="class">class</option>
              <option value="interface">interface</option>
              <option value="abstract">abstract</option>
              <option value="enum">enum</option>
            </select></label>
          <label className="field"><span>필드 — 한 줄에 하나 (예: - id: Long)</span>
            <LinesArea key={`${node.id}-f`} rows={4} onFocus={onFocusSnapshot}
              initial={linesOf(node.fields)} onLines={(lines) => onNode({ fields: lines })} /></label>
          <label className="field"><span>메서드 — 한 줄에 하나 (예: + save(): void)</span>
            <LinesArea key={`${node.id}-m`} rows={4} onFocus={onFocusSnapshot}
              initial={linesOf(node.methods)} onLines={(lines) => onNode({ methods: lines })} /></label>
        </>
      )}

      {node && !["table", "class", "initial", "final"].includes(node.kind) && (
        <label className="field"><span>이름</span>
          <input className="krw-input small" spellCheck={false} onFocus={onFocusSnapshot} value={node.label ?? ""} onChange={(e) => onNode({ label: e.target.value })} /></label>
      )}
      {node && (node.kind === "initial" || node.kind === "final") && (
        <p className="hint">{node.kind === "initial" ? "시작점" : "끝점"}은 내용이 없습니다 — 화살표만 이어 주세요.</p>
      )}

      {edge && (
        <>
          {doc.type === "class" && (
            <label className="field"><span>관계 종류</span>
              <select value={edge.kind ?? "assoc"} onFocus={onFocusSnapshot}
                onChange={(e) => onEdge({ kind: e.target.value })}>
                <option value="assoc">연관 (→)</option>
                <option value="extends">상속 — 자식에서 부모로</option>
                <option value="implements">구현 — 클래스에서 인터페이스로</option>
              </select></label>
          )}
          {doc.type === "er" && (
            <div className="cv-cards">
              <label className="field"><span>시작 쪽</span>
                <select value={edge.fromCard ?? "1"} onFocus={onFocusSnapshot} onChange={(e) => onEdge({ fromCard: e.target.value })}>
                  <option>1</option><option>N</option><option>0..1</option></select></label>
              <label className="field"><span>끝 쪽</span>
                <select value={edge.toCard ?? "N"} onFocus={onFocusSnapshot} onChange={(e) => onEdge({ toCard: e.target.value })}>
                  <option>N</option><option>1</option><option>0..1</option></select></label>
            </div>
          )}
          <label className="field"><span>{doc.type === "flowchart" ? "조건 (예 / 아니오)" : "라벨"}</span>
            <input className="krw-input small" spellCheck={false} onFocus={onFocusSnapshot} value={edge.label ?? ""} onChange={(e) => onEdge({ label: e.target.value })} /></label>
        </>
      )}

      <button type="button" className="btn cv-danger" onClick={onDelete}>
        {node ? "이 상자 삭제" : "이 화살표 삭제"}
      </button>
    </aside>
  );
}

// ── 편집기 본체 ─────────────────────────────────────────────────────

/**
 * @param seed 코드 붙여넣기 탭에서 넘겨받은 문서. 부모가 key 를 바꿔 리마운트하는 방식이라
 *             여기서는 첫 렌더의 초기값으로만 쓴다 — 상태 동기화 효과가 필요 없다.
 */
export function CanvasEditor({ type, seed = null }) {
  const storageKey = `dtb.canvas.${type}`;

  const [doc, setDoc] = useState(() => {
    if (seed) return seed;
    // 지난번에 그리던 것을 이어서 — localStorage 는 읽기조차 막힌 환경이 있어 전부 감싼다
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const r = deserialize(saved);
        if (r.ok && r.doc.type === type) return r.doc;
      }
    } catch { /* 비공개 창 등 — 빈 문서로 시작 */ }
    return createDoc(type);
  });
  const [sel, setSel] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [ghost, setGhost] = useState(null);       // 연결 중 임시 선 {x1,y1,x2,y2}

  const svgRef = useRef(null);
  const fileRef = useRef(null);
  const drag = useRef(null);
  const past = useRef([]);
  const future = useRef([]);
  const docRef = useRef(doc);
  useEffect(() => { docRef.current = doc; }, [doc]);
  // 실행취소 버튼의 켜짐 여부 — ref 는 렌더에서 못 읽으므로 개수만 상태로 따라간다
  const [hist, setHist] = useState({ past: 0, future: 0 });
  const syncHist = () => setHist({ past: past.current.length, future: future.current.length });

  // ── 실행취소 — 조작 직전의 문서를 쌓는다 ──
  const commit = useCallback((next) => {
    past.current.push(docRef.current);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    setDoc(next);
    syncHist();
  }, []);
  /** 입력 중 연타로 이력이 늘지 않게 — 포커스 시점 문서를 한 번만 쌓고 이후엔 그대로 바꾼다 */
  const snapshot = useCallback(() => {
    past.current.push(docRef.current);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    syncHist();
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(docRef.current);
    setDoc(prev);
    setSel(null);
    syncHist();
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(docRef.current);
    setDoc(next);
    setSel(null);
    syncHist();
  }, []);

  // ── 자동 저장 ──
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(storageKey, serialize(doc)); } catch { /* 저장 불가 환경 — 조용히 통과 */ }
    }, 300);
    return () => clearTimeout(t);
  }, [doc, storageKey]);

  const nodesById = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc.nodes]);

  const toWorld = (clientX, clientY) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.k, y: (clientY - r.top - view.y) / view.k };
  };

  // ── 포인터 — 상자 드래그 · 빈 곳 패닝 · 점에서 연결 ──
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const handle = e.target.closest?.("[data-handle-of]");
    const nodeEl = e.target.closest?.("[data-node-id]");
    const edgeEl = e.target.closest?.("[data-edge-id]");
    e.currentTarget.setPointerCapture(e.pointerId);

    if (handle) {
      const fromId = handle.getAttribute("data-handle-of");
      const p = toWorld(e.clientX, e.clientY);
      drag.current = { mode: "connect", fromId };
      setGhost({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    if (nodeEl) {
      const id = nodeEl.getAttribute("data-node-id");
      const n = nodesById.get(id);
      const p = toWorld(e.clientX, e.clientY);
      drag.current = { mode: "node", id, dx: p.x - n.x, dy: p.y - n.y, moved: false };
      setSel({ kind: "node", id });
      return;
    }
    if (edgeEl) {
      setSel({ kind: "edge", id: edgeEl.getAttribute("data-edge-id") });
      drag.current = null;
      return;
    }
    drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    setSel(null);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pan") {
      setView((v) => ({ ...v, x: d.vx + (e.clientX - d.sx), y: d.vy + (e.clientY - d.sy) }));
      return;
    }
    const p = toWorld(e.clientX, e.clientY);
    if (d.mode === "node") {
      if (!d.moved) { snapshot(); d.moved = true; }   // 이력은 드래그당 한 번
      setDoc((cur) => moveNode(cur, d.id, Math.round(p.x - d.dx), Math.round(p.y - d.dy)));
      return;
    }
    if (d.mode === "connect") setGhost((g) => g && { ...g, x2: p.x, y2: p.y });
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode !== "connect") return;
    setGhost(null);
    // 캡처 중이라 e.target 이 svg 다 — 실제 떨어진 곳은 좌표로 찾는다
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest?.("[data-node-id]");
    if (!target) return;
    const toId = target.getAttribute("data-node-id");
    const [next, id] = addEdge(docRef.current, { from: d.fromId, to: toId, ...edgeDefaults(type) });
    if (id) { commit(next); setSel({ kind: "edge", id }); }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const r = svgRef.current.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    setView((v) => {
      const k = Math.min(2.5, Math.max(0.3, v.k * Math.exp(-e.deltaY * 0.0012)));
      // 커서 밑의 점이 그대로 있게 확대 중심을 옮긴다
      return { k, x: sx - ((sx - v.x) / v.k) * k, y: sy - ((sy - v.y) / v.k) * k };
    });
  };

  // ── 키보드 ──
  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); deleteSelection(); }
    if (e.key === "Escape") { setSel(null); setGhost(null); drag.current = null; }
  };

  const deleteSelection = () => {
    if (!sel) return;
    commit(sel.kind === "node" ? removeNodes(doc, [sel.id]) : removeEdge(doc, sel.id));
    setSel(null);
  };

  // ── 도구 상자 ──
  const addFromPalette = (make) => {
    // 화면 가운데 근처, 겹치지 않게 살짝씩 흘린다
    const r = svgRef.current.getBoundingClientRect();
    const c = toWorld(r.left + r.width / 2, r.top + r.height / 3);
    const jitter = (doc.nodes.length % 5) * 24;
    const [next, id] = addNode(doc, { ...make(), x: Math.round(c.x - 80 + jitter), y: Math.round(c.y + jitter) });
    commit(next);
    setSel({ kind: "node", id });
  };

  // ── 파일 ──
  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  const saveSvg = () => download(new Blob([toSvgString(doc)], { type: "image/svg+xml" }), `${type}-diagram.svg`);
  const savePng = () => {
    const svg = toSvgString(doc);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * 2;    // 문서에 붙일 걸 생각해 2배로
      canvas.height = img.height * 2;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => b && download(b, `${type}-diagram.png`), "image/png");
    };
    img.src = url;
  };
  const saveJson = () => download(new Blob([serialize(doc)], { type: "application/json" }), `${type}-diagram.json`);
  const loadJson = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = deserialize(String(reader.result));
      if (!r.ok) { alert(r.reason); return; }
      if (r.doc.type !== type) { alert(`이 파일은 ${r.doc.type} 그림입니다.`); return; }
      commit(r.doc);
      setSel(null);
      setView({ x: 0, y: 0, k: 1 });   // 화면을 제자리로 — 안 그러면 불러온 그림이 화면 밖에 있다
    };
    reader.readAsText(file);
  };

  return (
    <div className="canvas-editor" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="toolbar cv-toolbar">
        {PALETTE[type].map((p) => (
          <button key={p.label} type="button" className="btn" onClick={() => addFromPalette(p.make)}>+ {p.label}</button>
        ))}
        <span className="cv-sep" />
        <button type="button" className="btn ghost" onClick={undo} disabled={!hist.past}>↩ 되돌리기</button>
        <button type="button" className="btn ghost" onClick={redo} disabled={!hist.future}>↪ 다시하기</button>
        <button type="button" className="btn ghost" onClick={() => { commit(autoLayout(doc)); setView({ x: 0, y: 0, k: 1 }); }} disabled={!doc.nodes.length}>자동 배치</button>
        <div className="toolbar-right">
          <button type="button" className="btn" onClick={saveSvg} disabled={!doc.nodes.length}>SVG</button>
          <button type="button" className="btn" onClick={savePng} disabled={!doc.nodes.length}>PNG</button>
          <CopyButton value={() => toMermaidText(doc)} label="mermaid 복사" />
          <button type="button" className="btn" onClick={saveJson} disabled={!doc.nodes.length}>저장</button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>불러오기</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden
            onChange={(e) => { loadJson(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className="btn ghost" onClick={() => { commit(createDoc(type)); setSel(null); }} disabled={!doc.nodes.length}>전체 지우기</button>
        </div>
      </div>

      <div className="cv-body">
        <svg
          ref={svgRef}
          className="cv-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          <defs>
            <pattern id="cv-grid" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.2" fill="var(--cv-dot)" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#cv-grid)" pointerEvents="none" />
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {doc.edges.map((e) => {
              const g = edgeGeometry(doc, e, nodesById);
              const on = sel?.kind === "edge" && sel.id === e.id;
              return (
                <g key={e.id} data-edge-id={e.id} className={`cv-edge${on ? " on" : ""}`}>
                  <path d={g.path} className="cv-edge-hit" />
                  <path d={g.path} className="cv-edge-line" strokeDasharray={g.dashed ? "6 5" : undefined} />
                  <polygon points={g.arrow.map((p) => p.join(",")).join(" ")}
                    className={g.hollow ? "cv-arrow hollow" : "cv-arrow"} />
                  {e.label && <text x={g.mx} y={g.my - 6} textAnchor="middle" className="cv-edge-label">{e.label}</text>}
                  {doc.type === "er" && e.fromCard && !g.self && (
                    <text x={g.x1 + (g.x2 - g.x1) * 0.12} y={g.y1 + (g.y2 - g.y1) * 0.12 - 5} textAnchor="middle" className="cv-edge-label">{e.fromCard}</text>
                  )}
                  {doc.type === "er" && e.toCard && !g.self && (
                    <text x={g.x1 + (g.x2 - g.x1) * 0.88} y={g.y1 + (g.y2 - g.y1) * 0.88 - 5} textAnchor="middle" className="cv-edge-label">{e.toCard}</text>
                  )}
                </g>
              );
            })}

            {ghost && <line x1={ghost.x1} y1={ghost.y1} x2={ghost.x2} y2={ghost.y2} className="cv-ghost" />}

            {doc.nodes.map((n) => {
              const on = sel?.kind === "node" && sel.id === n.id;
              const { w, h } = nodeSize(n);
              return (
                <g key={n.id} data-node-id={n.id} className={`cv-node${on ? " on" : ""}`}>
                  {on && <rect x={n.x - 5} y={n.y - 5} width={w + 10} height={h + 10} rx={12} className="cv-selring" />}
                  {shapePrimitives(n).map((p, i) => <Prim key={i} p={p} />)}
                  {/* 연결 시작점 — 오른쪽 가운데의 점을 끌어 다른 상자에 놓는다 */}
                  <circle cx={n.x + w} cy={n.y + h / 2} r={7} className="cv-handle" data-handle-of={n.id} />
                </g>
              );
            })}
          </g>
        </svg>

        <EditPanel
          doc={doc}
          sel={sel}
          onFocusSnapshot={snapshot}
          onNode={(patch) => setDoc((cur) => updateNode(cur, sel.id, patch))}
          onEdge={(patch) => setDoc((cur) => updateEdge(cur, sel.id, patch))}
          onDelete={deleteSelection}
        />
      </div>

      <p className="hint cv-hint">
        빈 곳 드래그 = 화면 이동 · 휠 = 확대/축소({Math.round(view.k * 100)}%) ·
        상자 오른쪽 <b>점</b>을 끌어 다른 상자에 놓으면 연결 ·
        Delete = 삭제 · Ctrl+Z = 실행취소 — 그림은 이 브라우저에 자동 저장됩니다.
      </p>
    </div>
  );
}
