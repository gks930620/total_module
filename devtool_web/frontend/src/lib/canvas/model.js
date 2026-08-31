// 그리기 편집기의 문서 모델 — 전부 순수 함수다.
//
// 편집기(드래그·연결·실행취소)는 상태가 복잡해 보이지만, 실제 상태는 이 문서 객체 하나다.
// 모든 조작이 "문서 → 새 문서" 라서 실행취소는 이전 문서를 쌓아 두는 것으로 끝난다.
// UI 는 이 함수들을 부르고 결과를 그릴 뿐이다 — 그래서 신뢰성 검증이 전부 여기에 모인다.
//
// 노드 = { id, kind, x, y, ...내용 }   간선 = { id, from, to, kind?, label?, fromCard?, toCard? }

import { toErMermaid, safeName } from "../diagram/toMermaid.js";

/** 새 문서. type: er | class | flowchart | state */
export function createDoc(type) {
  return { v: 1, type, nodes: [], edges: [], seq: 1 };
}

const withSeq = (doc) => ({ ...doc, seq: doc.seq + 1 });

/** @returns {[doc, id]} */
export function addNode(doc, props) {
  const id = `n${doc.seq}`;
  const node = { id, x: 0, y: 0, ...props };
  return [{ ...withSeq(doc), nodes: [...doc.nodes, node] }, id];
}

export function moveNode(doc, id, x, y) {
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) };
}

export function updateNode(doc, id, patch) {
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

/** 노드와, 그 노드에 걸린 간선을 함께 지운다 — 남으면 유령 화살표가 된다 */
export function removeNodes(doc, ids) {
  const gone = new Set(ids);
  return {
    ...doc,
    nodes: doc.nodes.filter((n) => !gone.has(n.id)),
    edges: doc.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to)),
  };
}

/** 자기 자신으로 가는 간선 — 상태 전이·순서도 반복에는 실제로 있다. ER·클래스에는 없다. */
const SELF_LOOP_OK = new Set(["state", "flowchart"]);

/** @returns {[doc, id|null]} 못 더하는 간선이면 id 가 null */
export function addEdge(doc, props) {
  if (props.from === props.to && !SELF_LOOP_OK.has(doc.type)) return [doc, null];
  const same = (e) =>
    e.from === props.from && e.to === props.to &&
    (e.kind ?? "") === (props.kind ?? "") && (e.label ?? "") === (props.label ?? "");
  if (doc.edges.some(same)) return [doc, null];
  const id = `e${doc.seq}`;
  return [{ ...withSeq(doc), edges: [...doc.edges, { id, ...props }] }, id];
}

export function updateEdge(doc, id, patch) {
  return { ...doc, edges: doc.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

export function removeEdge(doc, id) {
  return { ...doc, edges: doc.edges.filter((e) => e.id !== id) };
}

// ── 크기 — 내용이 정하고, 화면과 내보내기가 같은 값을 쓴다 ──────────────

const approxWidth = (s) => {
  // 한글은 폭이 넓다 — 글꼴 실측 없이 쓰는 근사치
  let w = 0;
  for (const ch of String(s ?? "")) w += /[가-힣]/.test(ch) ? 14 : 8;
  return w;
};

export function nodeSize(node) {
  switch (node.kind) {
    case "table": {
      const rows = node.fields?.length || 1;
      const wide = Math.max(approxWidth(node.name), ...(node.fields ?? []).map((f) => approxWidth(`${f.name} ${f.type}`) + 30));
      return { w: Math.max(180, wide + 36), h: 34 + rows * 22 + 8 };
    }
    case "class": {
      const lines = [...(node.fields ?? []), ...(node.methods ?? [])];
      const wide = Math.max(approxWidth(node.name), ...lines.map(approxWidth));
      const h = 34 + (node.stereo && node.stereo !== "class" ? 18 : 0)
        + (node.fields?.length ?? 0) * 20
        + (node.methods?.length ? 6 + node.methods.length * 20 : 0) + 10;
      return { w: Math.max(190, wide + 36), h: Math.max(56, h) };
    }
    case "decision":
      return { w: Math.max(130, approxWidth(node.label) + 70), h: 70 };
    case "db":
      return { w: Math.max(130, approxWidth(node.label) + 44), h: 66 };
    case "start":
    case "end":
      return { w: Math.max(96, approxWidth(node.label) + 44), h: 42 };
    case "initial":
    case "final":
      return { w: 26, h: 26 };
    default: // step · state
      return { w: Math.max(120, approxWidth(node.label) + 40), h: 46 };
  }
}

// ── 붙여넣은 코드 → 문서 ────────────────────────────────────────────

/** parseDdl / parseJavaSource 결과를 문서로. 배치까지 끝내서 돌려준다. */
export function fromParsed(type, parsed) {
  let doc = createDoc(type);
  const idOf = new Map();

  for (const e of parsed?.entities ?? []) {
    let id;
    if (type === "er") {
      [doc, id] = addNode(doc, { kind: "table", name: e.name, fields: e.fields ?? [] });
    } else {
      [doc, id] = addNode(doc, {
        kind: "class",
        name: e.name,
        stereo: e.kind && e.kind !== "table" ? e.kind : "class",
        fields: (e.fields ?? []).map((f) => `${f.visibility || "+"} ${f.name}${f.type ? `: ${f.type}` : ""}`),
        methods: (e.methods ?? []).map((m) => `${m.visibility || "+"} ${m.name}(${m.params || ""})${m.returns ? `: ${m.returns}` : ""}`),
      });
    }
    idOf.set(e.name, id);
  }

  for (const r of parsed?.relations ?? []) {
    const from = idOf.get(r.from);
    const to = idOf.get(r.to);
    if (!from || !to) continue;   // 없는 상대를 향한 화살표는 그림을 거짓말로 만든다
    [doc] = addEdge(doc, { from, to, kind: r.kind, label: r.label, fromCard: r.fromCard, toCard: r.toCard });
  }
  return autoLayout(doc);
}

// ── 자동 배치 — 층으로 나눠 왼쪽에서 오른쪽으로 ─────────────────────

const GAP_X = 90;
const GAP_Y = 34;

export function autoLayout(doc) {
  const layer = new Map();
  const indeg = new Map(doc.nodes.map((n) => [n.id, 0]));
  for (const e of doc.edges) if (e.from !== e.to && indeg.has(e.to)) indeg.set(e.to, indeg.get(e.to) + 1);

  // Kahn — 뿌리부터 층을 매긴다. 순환에 갇힌 노드는 나중에 0층으로 받는다(죽는 것보단 낫다).
  let queue = doc.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  queue.forEach((id) => layer.set(id, 0));
  while (queue.length) {
    const next = [];
    for (const id of queue) {
      for (const e of doc.edges) {
        if (e.from !== id || e.from === e.to) continue;
        indeg.set(e.to, indeg.get(e.to) - 1);
        const cand = layer.get(id) + 1;
        if ((layer.get(e.to) ?? -1) < cand) layer.set(e.to, cand);
        if (indeg.get(e.to) === 0) next.push(e.to);
      }
    }
    queue = next;
  }
  for (const n of doc.nodes) if (!layer.has(n.id)) layer.set(n.id, 0);

  // 층별로 세로로 쌓고, 층의 x 는 앞 층의 최대 폭만큼 민다
  const byLayer = new Map();
  for (const n of doc.nodes) {
    const l = layer.get(n.id);
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l).push(n);
  }

  const pos = new Map();
  let x = 40;
  for (const l of [...byLayer.keys()].sort((a, b) => a - b)) {
    const col = byLayer.get(l);
    let y = 40;
    let maxW = 0;
    for (const n of col) {
      const { w, h } = nodeSize(n);
      pos.set(n.id, { x, y });
      y += h + GAP_Y;
      maxW = Math.max(maxW, w);
    }
    x += maxW + GAP_X;
  }
  return { ...doc, nodes: doc.nodes.map((n) => ({ ...n, ...pos.get(n.id) })) };
}

// ── 저장 · 불러오기 ────────────────────────────────────────────────

export function serialize(doc) {
  return JSON.stringify({ v: 1, type: doc.type, nodes: doc.nodes, edges: doc.edges });
}

/** @returns {{ok:true, doc}|{ok:false, reason}} 예외를 던지지 않는다 — 파일은 남이 만든 것일 수 있다 */
export function deserialize(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, reason: "JSON 이 아닙니다." }; }
  if (!raw || raw.v !== 1 || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges) || typeof raw.type !== "string") {
    return { ok: false, reason: "이 도구가 저장한 파일이 아닙니다." };
  }
  // 불러온 뒤 새로 만드는 id 가 기존과 겹치지 않게 — 겹치면 엉뚱한 노드가 움직인다
  let seq = 1;
  for (const item of [...raw.nodes, ...raw.edges]) {
    const m = /^[ne](\d+)$/.exec(item?.id ?? "");
    if (m) seq = Math.max(seq, Number(m[1]) + 1);
  }
  return { ok: true, doc: { v: 1, type: raw.type, nodes: raw.nodes, edges: raw.edges, seq } };
}

// ── ER 필드 한 줄 파싱 — 편집 패널이 쓴다 ──────────────────────────
/**
 * "email VARCHAR(255) NN UQ" → {name, type, pk, fk, unique, nullable}
 *  SQL 버릇대로 끝에 쉼표·세미콜론을 붙이는 손이 많다 — 떼고 읽는다. */
export function parseErFieldLine(line) {
  const tokens = String(line ?? "").trim().replace(/[,;]+$/, "").split(/\s+/).filter(Boolean);
  const flags = { pk: false, fk: false, unique: false, nullable: true };
  while (tokens.length) {
    const t = tokens[tokens.length - 1].toUpperCase();
    if (t === "PK") { flags.pk = true; flags.nullable = false; tokens.pop(); continue; }
    if (t === "FK") { flags.fk = true; tokens.pop(); continue; }
    if (t === "UQ" || t === "UNIQUE") { flags.unique = true; tokens.pop(); continue; }
    if (t === "NN" || t === "NOTNULL") { flags.nullable = false; tokens.pop(); continue; }
    break;
  }
  const name = tokens.shift() ?? "";
  const type = tokens.join(" ") || "?";
  return { name, type, ...flags };
}

// ── mermaid 로 내보내기 — 그린 것을 텍스트 세계로 되돌린다 ──────────

const nodeById = (doc, id) => doc.nodes.find((n) => n.id === id);

export function toMermaidText(doc) {
  if (doc.type === "er") {
    return toErMermaid({
      entities: doc.nodes.map((n) => ({ name: n.name, kind: "table", fields: n.fields ?? [] })),
      relations: doc.edges.map((e) => ({
        from: nodeById(doc, e.from)?.name,
        to: nodeById(doc, e.to)?.name,
        kind: "fk",
        fromCard: e.fromCard ?? "1",
        toCard: e.toCard ?? "N",
        label: e.label,
      })),
    });
  }

  if (doc.type === "class") {
    const lines = ["classDiagram"];
    const member = (s) => String(s).replace(/</g, "~").replace(/>/g, "~").trim();
    for (const n of doc.nodes) {
      lines.push(`    class ${safeName(n.name)} {`);
      if (n.stereo && n.stereo !== "class") lines.push(`        <<${n.stereo}>>`);
      for (const f of n.fields ?? []) lines.push(`        ${member(f)}`);
      for (const m of n.methods ?? []) lines.push(`        ${member(m)}`);
      lines.push("    }");
    }
    for (const e of doc.edges) {
      const from = safeName(nodeById(doc, e.from)?.name);
      const to = safeName(nodeById(doc, e.to)?.name);
      // 상속·구현은 사용자가 자식→부모로 긋는다(화살촉이 부모 쪽).
      // mermaid 는 '부모 <|-- 자식' 이라 좌우가 뒤집힌다 — 여기서 맞춘다.
      if (e.kind === "extends") { lines.push(`    ${to} <|-- ${from}`); continue; }
      if (e.kind === "implements") { lines.push(`    ${to} <|.. ${from}`); continue; }
      lines.push(`    ${from} --> ${to}${e.label ? ` : ${e.label}` : ""}`);
    }
    return lines.join("\n");
  }

  if (doc.type === "flowchart") {
    const wrap = { start: (l) => `([${l}])`, end: (l) => `([${l}])`, decision: (l) => `{${l}}`, db: (l) => `[(${l})]` };
    const shape = (n) => `${n.id}${(wrap[n.kind] ?? ((l) => `[${l}]`))(n.label || " ")}`;
    const lines = ["flowchart TD"];
    const linked = new Set();
    for (const e of doc.edges) {
      linked.add(e.from); linked.add(e.to);
      const a = nodeById(doc, e.from); const b = nodeById(doc, e.to);
      lines.push(`    ${shape(a)} -->${e.label ? `|${e.label}|` : ""} ${shape(b)}`);
    }
    for (const n of doc.nodes) if (!linked.has(n.id)) lines.push(`    ${shape(n)}`);
    return lines.join("\n");
  }

  // state
  const stName = (n) => (n.kind === "initial" || n.kind === "final" ? "[*]" : safeName(n.label || n.id));
  const lines = ["stateDiagram-v2"];
  const linked = new Set();
  for (const e of doc.edges) {
    linked.add(e.from); linked.add(e.to);
    lines.push(`    ${stName(nodeById(doc, e.from))} --> ${stName(nodeById(doc, e.to))}${e.label ? `: ${e.label}` : ""}`);
  }
  for (const n of doc.nodes) {
    if (!linked.has(n.id) && n.kind === "state") lines.push(`    ${stName(n)}`);
  }
  return lines.join("\n");
}
