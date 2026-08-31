// 시퀀스 그리기 모델 — 참가자(세로줄)와 시간순 메시지.
//
// 상자-화살표 캔버스(model.js)와 따로 두는 이유: 시퀀스는 좌표를 사용자가 정하지 않는다.
// 참가자의 **순서**와 메시지의 **순서**가 곧 배치라서, 드래그 캔버스보다
// 목록을 위아래로 옮기는 편집이 정확하고 실수도 적다.

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function createSeq() {
  return { v: 1, type: "sequence", participants: [], messages: [], seq: 1 };
}

const bump = (s) => ({ ...s, seq: s.seq + 1 });

/** @returns {[seq, id]} */
export function addParticipant(s, name) {
  const id = `p${s.seq}`;
  return [{ ...bump(s), participants: [...s.participants, { id, name }] }, id];
}

export function renameParticipant(s, id, name) {
  return { ...s, participants: s.participants.map((p) => (p.id === id ? { ...p, name } : p)) };
}

/** dir: -1 왼쪽 / +1 오른쪽 */
export function moveParticipant(s, id, dir) {
  const i = s.participants.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.participants.length) return s;
  const arr = [...s.participants];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return { ...s, participants: arr };
}

/** 참가자를 지우면 그가 주고받던 메시지도 지운다 — 남으면 허공에서 오는 화살표가 된다 */
export function removeParticipant(s, id) {
  return {
    ...s,
    participants: s.participants.filter((p) => p.id !== id),
    messages: s.messages.filter((m) => m.from !== id && m.to !== id),
  };
}

/** kind: sync(실선 요청) | reply(점선 응답)  @returns {[seq, id]} */
export function addMessage(s, { from, to, label = "", kind = "sync" }) {
  const id = `m${s.seq}`;
  return [{ ...bump(s), messages: [...s.messages, { id, from, to, label, kind }] }, id];
}

export function updateMessage(s, id, patch) {
  return { ...s, messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
}

/** dir: -1 위 / +1 아래 */
export function moveMessage(s, id, dir) {
  const i = s.messages.findIndex((m) => m.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.messages.length) return s;
  const arr = [...s.messages];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return { ...s, messages: arr };
}

export function removeMessage(s, id) {
  return { ...s, messages: s.messages.filter((m) => m.id !== id) };
}

// ── 저장 · 불러오기 ────────────────────────────────────────────────

export function serializeSeq(s) {
  return JSON.stringify({ v: 1, type: "sequence", participants: s.participants, messages: s.messages });
}

export function deserializeSeq(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, reason: "JSON 이 아닙니다." }; }
  if (!raw || raw.v !== 1 || raw.type !== "sequence" || !Array.isArray(raw.participants) || !Array.isArray(raw.messages)) {
    return { ok: false, reason: "이 도구가 저장한 시퀀스 파일이 아닙니다." };
  }
  let seq = 1;
  for (const it of [...raw.participants, ...raw.messages]) {
    const m = /^[pm](\d+)$/.exec(it?.id ?? "");
    if (m) seq = Math.max(seq, Number(m[1]) + 1);
  }
  return { ok: true, seq: { v: 1, type: "sequence", participants: raw.participants, messages: raw.messages, seq } };
}

// ── mermaid 내보내기 ───────────────────────────────────────────────

export function toSequenceMermaid(s) {
  const lines = ["sequenceDiagram"];
  const alias = new Map(s.participants.map((p, i) => [p.id, `P${i + 1}`]));
  for (const p of s.participants) {
    lines.push(`    participant ${alias.get(p.id)} as ${String(p.name).replace(/\n/g, " ") || "이름"}`);
  }
  for (const m of s.messages) {
    const arrow = m.kind === "reply" ? "-->>" : "->>";
    lines.push(`    ${alias.get(m.from)}${arrow}${alias.get(m.to)}: ${String(m.label).replace(/\n/g, " ") || " "}`);
  }
  return lines.join("\n");
}

// ── SVG 내보내기 — 화면 렌더와 같은 배치 상수를 쓴다 ────────────────

export const SEQ_LAYOUT = {
  colW: 170,      // 참가자 간격
  headW: 130,     // 머리 상자 폭
  headH: 40,
  top: 24,
  rowH: 48,       // 메시지 간격
  firstRow: 96,   // 첫 메시지 y
  pad: 24,
};

export function seqExtent(s) {
  const L = SEQ_LAYOUT;
  const w = Math.max(1, s.participants.length) * L.colW + L.pad;
  const h = L.firstRow + Math.max(1, s.messages.length) * L.rowH + 40;
  return { w, h };
}

export const participantX = (s, id) => {
  const i = s.participants.findIndex((p) => p.id === id);
  return SEQ_LAYOUT.pad + i * SEQ_LAYOUT.colW + SEQ_LAYOUT.headW / 2;
};

export function toSequenceSvg(s) {
  const L = SEQ_LAYOUT;
  const { w, h } = seqExtent(s);
  const C = { line: "#c9c6e4", strong: "#63608a", text: "#2b2745", accent: "#6d5efc", surface: "#ffffff" };
  const parts = [];

  for (const p of s.participants) {
    const cx = participantX(s, p.id);
    parts.push(`<line x1="${cx}" y1="${L.top + L.headH}" x2="${cx}" y2="${h - 16}" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="5 5"/>`);
    parts.push(`<rect x="${cx - L.headW / 2}" y="${L.top}" width="${L.headW}" height="${L.headH}" rx="12" fill="${C.surface}" stroke="${C.line}" stroke-width="1.5"/>`);
    parts.push(`<text x="${cx}" y="${L.top + L.headH / 2 + 4}" text-anchor="middle" font-size="13" font-weight="700" fill="${C.text}">${esc(p.name)}</text>`);
  }

  s.messages.forEach((m, i) => {
    const y = L.firstRow + i * L.rowH;
    const dash = m.kind === "reply" ? ' stroke-dasharray="6 5"' : "";
    if (m.from === m.to) {
      const x = participantX(s, m.from);
      parts.push(`<path d="M ${x} ${y - 8} H ${x + 44} V ${y + 12} H ${x + 8}" fill="none" stroke="${C.strong}" stroke-width="1.5"${dash}/>`);
      parts.push(`<polygon points="${x + 8},${y + 12} ${x + 18},${y + 7} ${x + 18},${y + 17}" fill="${C.strong}"/>`);
      parts.push(`<text x="${x + 52}" y="${y + 2}" font-size="12" fill="${C.text}">${esc(m.label)}</text>`);
      return;
    }
    const x1 = participantX(s, m.from);
    const x2 = participantX(s, m.to);
    const dir = x2 > x1 ? 1 : -1;
    parts.push(`<line x1="${x1}" y1="${y}" x2="${x2 - dir * 4}" y2="${y}" stroke="${C.strong}" stroke-width="1.5"${dash}/>`);
    parts.push(`<polygon points="${x2},${y} ${x2 - dir * 11},${y - 5} ${x2 - dir * 11},${y + 5}" fill="${C.strong}"/>`);
    parts.push(`<text x="${(x1 + x2) / 2}" y="${y - 7}" text-anchor="middle" font-size="12" stroke="${C.surface}" stroke-width="4" paint-order="stroke" fill="${C.text}">${esc(m.label)}</text>`);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="system-ui, 'Malgun Gothic', sans-serif">
  <rect x="0" y="0" width="${w}" height="${h}" fill="${C.surface}"/>
  ${parts.join("\n  ")}
</svg>`;
}
