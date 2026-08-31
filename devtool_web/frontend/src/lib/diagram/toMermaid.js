// 다이어그램 모델 → mermaid 텍스트.
//
// 여기서 만든 텍스트는 화면에 그대로 보여 주고 사용자가 손으로 고칠 수 있게 한다.
// 그러니 "돌아가기만 하는" 문자열이 아니라 읽을 수 있게 들여쓰고 줄을 나눈다.
//
// mermaid 문법에는 그냥 넣으면 깨지는 자리가 여럿이라 그걸 막는 게 이 파일의 절반이다.
//   · ER 속성 타입의 괄호·쉼표     varchar(255) → varchar_255_
//   · 클래스 제네릭의 꺾쇠          List<Order>  → List~Order~
//   · 점이 든 이름                  com.a.Member → Member
//   · mermaid 예약어                class        → class_
// 하나라도 놓치면 "붙여넣으면 그림이 나온다" 는 약속이 조용히 깨진다.

/** mermaid 가 이름으로 받아 주지 않는 말들 */
const RESERVED = new Set([
  "class", "classDiagram", "erDiagram", "graph", "flowchart", "subgraph", "end",
  "state", "note", "click", "style", "direction", "namespace", "link", "callback",
]);

/** 이름을 mermaid 가 받아 주는 모양으로 — 점을 떼고, 예약어는 밑줄을 붙인다 */
export function safeName(raw) {
  let s = String(raw ?? "").trim().split(".").pop() || "";
  s = s.replace(/[^\w가-힣$]/g, "_");
  if (!s) return "unnamed";
  if (RESERVED.has(s)) return `${s}_`;
  if (/^\d/.test(s)) return `_${s}`;
  return s;
}

/** ER 속성의 타입 — 괄호·쉼표·공백이 있으면 파서가 죽는다 */
function erType(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  return s.replace(/[^\w]/g, "_").replace(/_+$/, "") || "unknown";
}

/** 라벨의 큰따옴표만 정리한다 — 그대로 두면 문자열이 일찍 닫힌다 */
const label = (s) => String(s ?? "").replace(/"/g, "'").trim();

/**
 * ER 다이어그램.
 * @param {import("./parseCode.js").DiagramModel} model
 */
export function toErMermaid(model) {
  const lines = ["erDiagram"];
  const entities = model?.entities ?? [];
  const relations = model?.relations ?? [];

  // 관계를 먼저 적는다 — mermaid 가 이 순서로 배치를 잡아 읽기 좋아진다
  for (const r of relations) {
    const from = safeName(r.from);
    const to = safeName(r.to);
    // 부모(1) ||--o{ 자식(N). 자식이 없을 수도 있으니 o{ 를 쓴다.
    const link = r.toCard === "1" ? "||--||" : "||--o{";
    // 라벨이 없으면 mermaid 는 문법 오류로 본다 — 빈 문자열이라도 반드시 넣는다
    lines.push(`    ${from} ${link} ${to} : "${label(r.label) || "관계"}"`);
  }

  for (const e of entities) {
    lines.push(`    ${safeName(e.name)} {`);
    if (!e.fields.length) lines.push("        _ _");   // 빈 엔티티도 상자로는 보여 준다
    for (const f of e.fields) {
      const marks = [f.pk && "PK", f.fk && "FK", f.unique && !f.pk && "UK"].filter(Boolean).join(",");
      const note = f.nullable === false && !f.pk ? ' "필수"' : "";
      lines.push(`        ${erType(f.type)} ${safeName(f.name)}${marks ? ` ${marks}` : ""}${note}`);
    }
    lines.push("    }");
  }

  if (entities.length === 0) {
    lines.push("    %% 읽어낸 테이블이 없습니다. 왼쪽에 CREATE TABLE 문을 붙여넣어 보세요.");
  }
  return lines.join("\n");
}

/** 제네릭 꺾쇠를 mermaid 의 물결표로. List<Order> → List~Order~ */
function classType(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s.replace(/</g, "~").replace(/>/g, "~").replace(/,/g, ", ").replace(/\s+/g, " ");
}

const STEREOTYPE = {
  interface: "<<interface>>",
  enum: "<<enumeration>>",
  abstract: "<<abstract>>",
  record: "<<record>>",
};

/**
 * 클래스 다이어그램.
 * @param {import("./parseCode.js").DiagramModel} model
 */
export function toClassMermaid(model) {
  const lines = ["classDiagram"];
  const entities = model?.entities ?? [];
  const relations = model?.relations ?? [];

  for (const e of entities) {
    const name = safeName(e.name);
    lines.push(`    class ${name} {`);
    if (STEREOTYPE[e.kind]) lines.push(`        ${STEREOTYPE[e.kind]}`);

    for (const f of e.fields) {
      const t = classType(f.type);
      // enum 상수는 타입이 없다
      lines.push(`        ${f.visibility || "+"}${t ? `${t} ` : ""}${safeName(f.name)}`);
    }
    for (const m of e.methods ?? []) {
      const ret = classType(m.returns);
      const star = m.static ? "$" : "";
      lines.push(`        ${m.visibility || "+"}${safeName(m.name)}(${classType(m.params)})${star}${ret ? ` ${ret}` : ""}`);
    }
    lines.push("    }");
  }

  for (const r of relations) {
    const from = safeName(r.from);
    const to = safeName(r.to);
    if (r.kind === "extends") { lines.push(`    ${from} <|-- ${to}`); continue; }
    if (r.kind === "implements") { lines.push(`    ${from} <|.. ${to}`); continue; }
    if (r.kind === "composition") { lines.push(`    ${from} *-- ${to}`); continue; }

    // 연관 — 양쪽 개수를 아는 만큼만 붙인다
    const a = r.fromCard ? ` "${label(r.fromCard)}"` : "";
    const b = r.toCard ? ` "${label(r.toCard)}"` : "";
    const tail = r.label ? ` : ${label(r.label)}` : "";
    lines.push(`    ${from}${a} -->${b} ${to}${tail}`);
  }

  if (entities.length === 0) {
    // 주석만 남기면 mermaid 가 문법 오류로 본다 — erDiagram 은 받아 주는데 classDiagram 은 아니다.
    // 실물 파서에 먹여 보고서야 알았다. 빈 화면 대신 "여기에 나온다" 는 상자를 하나 그린다.
    lines.push("    class 자바소스를_붙여넣으세요 {");
    lines.push("        <<비어있음>>");
    lines.push("    }");
  }
  return lines.join("\n");
}
