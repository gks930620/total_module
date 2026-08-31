// 그리기 편집기 문서 모델 — 구현 전 선작성(Red).
// 편집기의 신뢰성은 전부 이 모델에 있다: 붙였다 뗐다 하는 UI 는 이 순수 함수들을 부를 뿐이다.
import { describe, it, expect } from "vitest";
import {
  createDoc, addNode, moveNode, updateNode, removeNodes,
  addEdge, updateEdge, removeEdge,
  nodeSize, fromParsed, autoLayout,
  serialize, deserialize, toMermaidText, parseErFieldLine,
} from "../canvas/model.js";

describe("문서 만들기·노드 CRUD", () => {
  it("빈 문서로 시작한다", () => {
    const doc = createDoc("er");
    expect(doc.type).toBe("er");
    expect(doc.nodes).toEqual([]);
    expect(doc.edges).toEqual([]);
  });

  it("노드를 더하면 고유 id 가 붙는다", () => {
    let doc = createDoc("flowchart");
    let a, b;
    [doc, a] = addNode(doc, { kind: "step", x: 10, y: 10, label: "처리" });
    [doc, b] = addNode(doc, { kind: "decision", x: 10, y: 100, label: "조건?" });
    expect(a).not.toBe(b);
    expect(doc.nodes).toHaveLength(2);
  });

  it("moveNode 는 좌표만 바꾼다", () => {
    let doc = createDoc("flowchart");
    let id;
    [doc, id] = addNode(doc, { kind: "step", x: 0, y: 0, label: "처리" });
    doc = moveNode(doc, id, 120, 80);
    const n = doc.nodes.find((x) => x.id === id);
    expect([n.x, n.y]).toEqual([120, 80]);
    expect(n.label).toBe("처리");
  });

  it("updateNode 는 내용만 바꾼다", () => {
    let doc = createDoc("er");
    let id;
    [doc, id] = addNode(doc, { kind: "table", x: 0, y: 0, name: "member", fields: [] });
    doc = updateNode(doc, id, { name: "orders" });
    expect(doc.nodes[0].name).toBe("orders");
  });

  it("노드를 지우면 걸린 간선도 같이 사라진다", () => {
    let doc = createDoc("flowchart");
    let a, b, c;
    [doc, a] = addNode(doc, { kind: "step", x: 0, y: 0, label: "A" });
    [doc, b] = addNode(doc, { kind: "step", x: 0, y: 100, label: "B" });
    [doc, c] = addNode(doc, { kind: "step", x: 0, y: 200, label: "C" });
    [doc] = addEdge(doc, { from: a, to: b });
    [doc] = addEdge(doc, { from: b, to: c });
    doc = removeNodes(doc, [b]);
    expect(doc.nodes.map((n) => n.id)).toEqual([a, c]);
    expect(doc.edges).toHaveLength(0);
  });
});

describe("간선", () => {
  const twoNodes = () => {
    let doc = createDoc("flowchart");
    let a, b;
    [doc, a] = addNode(doc, { kind: "step", x: 0, y: 0, label: "A" });
    [doc, b] = addNode(doc, { kind: "step", x: 0, y: 100, label: "B" });
    return { doc, a, b };
  };

  it("같은 간선을 두 번 더해도 하나만 남는다", () => {
    let { doc, a, b } = twoNodes();
    [doc] = addEdge(doc, { from: a, to: b, label: "예" });
    [doc] = addEdge(doc, { from: a, to: b, label: "예" });
    expect(doc.edges).toHaveLength(1);
  });

  it("라벨이 다르면 다른 간선이다", () => {
    let { doc, a, b } = twoNodes();
    [doc] = addEdge(doc, { from: a, to: b, label: "예" });
    [doc] = addEdge(doc, { from: a, to: b, label: "아니오" });
    expect(doc.edges).toHaveLength(2);
  });

  it("상태도는 자기 자신으로 가는 전이를 허용한다", () => {
    let doc = createDoc("state");
    let a;
    [doc, a] = addNode(doc, { kind: "state", x: 0, y: 0, label: "대기" });
    const [next, id] = addEdge(doc, { from: a, to: a, label: "재시도" });
    expect(id).not.toBeNull();
    expect(next.edges).toHaveLength(1);
  });

  it("ER 은 자기 참조를 막는다", () => {
    let doc = createDoc("er");
    let a;
    [doc, a] = addNode(doc, { kind: "table", x: 0, y: 0, name: "t", fields: [] });
    const [next, id] = addEdge(doc, { from: a, to: a });
    expect(id).toBeNull();
    expect(next.edges).toHaveLength(0);
  });

  it("updateEdge · removeEdge", () => {
    let { doc, a, b } = twoNodes();
    let e;
    [doc, e] = addEdge(doc, { from: a, to: b });
    doc = updateEdge(doc, e, { label: "예" });
    expect(doc.edges[0].label).toBe("예");
    doc = removeEdge(doc, e);
    expect(doc.edges).toHaveLength(0);
  });
});

describe("nodeSize — 내용에 따라 커진다", () => {
  it("필드가 많은 테이블이 더 크다", () => {
    const small = nodeSize({ kind: "table", name: "a", fields: [] });
    const big = nodeSize({ kind: "table", name: "a", fields: Array.from({ length: 6 }, (_, i) => ({ name: `c${i}`, type: "INT" })) });
    expect(big.h).toBeGreaterThan(small.h);
  });

  it("긴 라벨의 처리 상자가 더 넓다", () => {
    const a = nodeSize({ kind: "step", label: "짧다" });
    const b = nodeSize({ kind: "step", label: "아주 아주 아주 긴 처리 이름" });
    expect(b.w).toBeGreaterThan(a.w);
  });
});

describe("fromParsed — 붙여넣은 코드에서 그리기로", () => {
  const parsed = {
    entities: [
      { name: "member", kind: "table", fields: [{ name: "id", type: "BIGINT", pk: true }] },
      { name: "orders", kind: "table", fields: [{ name: "member_id", type: "BIGINT", fk: true }] },
    ],
    relations: [{ from: "member", to: "orders", kind: "fk", fromCard: "1", toCard: "N", label: "member_id" }],
  };

  it("엔티티가 노드로, 관계가 간선으로 온다", () => {
    const doc = fromParsed("er", parsed);
    expect(doc.nodes).toHaveLength(2);
    expect(doc.edges).toHaveLength(1);
    expect(doc.edges[0].fromCard).toBe("1");
  });

  it("배치까지 끝난 상태로 온다 — 좌표가 서로 다르다", () => {
    const doc = fromParsed("er", parsed);
    const [a, b] = doc.nodes;
    expect(a.x !== b.x || a.y !== b.y).toBe(true);
  });

  it("이름이 같은 관계 상대가 없으면 그 간선은 버린다", () => {
    const doc = fromParsed("er", {
      entities: [{ name: "a", kind: "table", fields: [] }],
      relations: [{ from: "a", to: "ghost", kind: "fk" }],
    });
    expect(doc.edges).toHaveLength(0);
  });
});

describe("autoLayout", () => {
  it("연결 순서대로 왼쪽에서 오른쪽으로 층이 진다", () => {
    let doc = createDoc("flowchart");
    let a, b, c;
    [doc, a] = addNode(doc, { kind: "start", x: 0, y: 0, label: "시작" });
    [doc, b] = addNode(doc, { kind: "step", x: 0, y: 0, label: "처리" });
    [doc, c] = addNode(doc, { kind: "end", x: 0, y: 0, label: "끝" });
    [doc] = addEdge(doc, { from: a, to: b });
    [doc] = addEdge(doc, { from: b, to: c });
    doc = autoLayout(doc);
    const x = (id) => doc.nodes.find((n) => n.id === id).x;
    expect(x(a)).toBeLessThan(x(b));
    expect(x(b)).toBeLessThan(x(c));
  });

  it("순환이 있어도 죽지 않고 전 노드에 좌표를 준다", () => {
    let doc = createDoc("state");
    let a, b;
    [doc, a] = addNode(doc, { kind: "state", x: 0, y: 0, label: "A" });
    [doc, b] = addNode(doc, { kind: "state", x: 0, y: 0, label: "B" });
    [doc] = addEdge(doc, { from: a, to: b });
    [doc] = addEdge(doc, { from: b, to: a });
    doc = autoLayout(doc);
    for (const n of doc.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });
});

describe("serialize / deserialize", () => {
  it("왕복해도 같다", () => {
    let doc = createDoc("er");
    let id;
    [doc, id] = addNode(doc, { kind: "table", x: 5, y: 7, name: "member", fields: [{ name: "id", type: "BIGINT", pk: true }] });
    const r = deserialize(serialize(doc));
    expect(r.ok).toBe(true);
    expect(r.doc.nodes[0]).toEqual(doc.nodes.find((n) => n.id === id));
  });

  it("쓰레기를 넣으면 ok:false 로 거절한다 — 예외를 던지지 않는다", () => {
    expect(deserialize("not json").ok).toBe(false);
    expect(deserialize('{"hello":1}').ok).toBe(false);
    expect(deserialize('{"v":1,"type":"er","nodes":"oops","edges":[]}').ok).toBe(false);
  });

  it("불러온 뒤 새 노드의 id 가 기존과 겹치지 않는다", () => {
    let doc = createDoc("er");
    [doc] = addNode(doc, { kind: "table", x: 0, y: 0, name: "a", fields: [] });
    [doc] = addNode(doc, { kind: "table", x: 0, y: 0, name: "b", fields: [] });
    const { doc: loaded } = deserialize(serialize(doc));
    const [, fresh] = addNode(loaded, { kind: "table", x: 0, y: 0, name: "c", fields: [] });
    expect(loaded.nodes.some((n) => n.id === fresh)).toBe(false);
  });
});

describe("parseErFieldLine — 필드 한 줄을 구조로", () => {
  it("이름 타입 플래그 순서로 읽는다", () => {
    expect(parseErFieldLine("id BIGINT PK")).toEqual(
      expect.objectContaining({ name: "id", type: "BIGINT", pk: true }));
    expect(parseErFieldLine("email VARCHAR(255) NN UQ")).toEqual(
      expect.objectContaining({ name: "email", type: "VARCHAR(255)", nullable: false, unique: true }));
    expect(parseErFieldLine("member_id BIGINT FK")).toEqual(
      expect.objectContaining({ fk: true }));
  });

  it("SQL 버릇대로 끝에 쉼표·세미콜론을 붙여도 읽는다", () => {
    expect(parseErFieldLine("id BIGINT PK,")).toEqual(
      expect.objectContaining({ name: "id", type: "BIGINT", pk: true }));
    expect(parseErFieldLine("email VARCHAR(255) NN,")).toEqual(
      expect.objectContaining({ type: "VARCHAR(255)", nullable: false }));
    expect(parseErFieldLine("name VARCHAR(20);")).toEqual(
      expect.objectContaining({ type: "VARCHAR(20)" }));
  });

  it("타입이 없으면 물음표로 둔다", () => {
    expect(parseErFieldLine("name").type).toBe("?");
  });
});

describe("toMermaidText — 그린 것을 문법으로 내보내기", () => {
  it("ER: 테이블과 관계가 문법에 나온다", () => {
    let doc = createDoc("er");
    let a, b;
    [doc, a] = addNode(doc, { kind: "table", x: 0, y: 0, name: "member", fields: [{ name: "id", type: "BIGINT", pk: true }] });
    [doc, b] = addNode(doc, { kind: "table", x: 0, y: 0, name: "orders", fields: [] });
    [doc] = addEdge(doc, { from: a, to: b, fromCard: "1", toCard: "N", label: "주문" });
    const t = toMermaidText(doc);
    expect(t).toContain("erDiagram");
    expect(t).toContain("member");
    expect(t).toContain("||--o{");
  });

  it("클래스: 자식→부모로 그은 상속이 mermaid 의 '부모 <|-- 자식' 으로 나간다", () => {
    // 사용자는 UML 관례대로 자식에서 부모를 향해 긋는다(속이 빈 삼각형이 부모 쪽).
    let doc = createDoc("class");
    let child, parent;
    [doc, parent] = addNode(doc, { kind: "class", x: 0, y: 0, name: "Animal", stereo: "class", fields: ["+ name: String"], methods: [] });
    [doc, child] = addNode(doc, { kind: "class", x: 0, y: 0, name: "Dog", stereo: "class", fields: [], methods: ["+ bark(): void"] });
    [doc] = addEdge(doc, { from: child, to: parent, kind: "extends" });
    const t = toMermaidText(doc);
    expect(t).toContain("classDiagram");
    expect(t).toContain("Animal <|-- Dog");
  });

  it("순서도: 모양이 종류를 따라간다", () => {
    let doc = createDoc("flowchart");
    let s, d, e;
    [doc, s] = addNode(doc, { kind: "start", x: 0, y: 0, label: "시작" });
    [doc, d] = addNode(doc, { kind: "decision", x: 0, y: 0, label: "재고?" });
    [doc, e] = addNode(doc, { kind: "end", x: 0, y: 0, label: "끝" });
    [doc] = addEdge(doc, { from: s, to: d });
    [doc] = addEdge(doc, { from: d, to: e, label: "예" });
    const t = toMermaidText(doc);
    expect(t).toContain("flowchart TD");
    expect(t).toContain("([");      // 시작·끝
    expect(t).toContain("{");       // 마름모
    expect(t).toContain("|예|");
  });

  it("상태도: 시작·끝은 [*] 로 나간다", () => {
    let doc = createDoc("state");
    let i, s, f;
    [doc, i] = addNode(doc, { kind: "initial", x: 0, y: 0 });
    [doc, s] = addNode(doc, { kind: "state", x: 0, y: 0, label: "결제 대기" });
    [doc, f] = addNode(doc, { kind: "final", x: 0, y: 0 });
    [doc] = addEdge(doc, { from: i, to: s });
    [doc] = addEdge(doc, { from: s, to: f, label: "승인" });
    const t = toMermaidText(doc);
    expect(t).toContain("stateDiagram-v2");
    expect(t).toContain("[*] -->");
    expect(t).toContain("--> [*]: 승인");
  });
});
