// 모델 → mermaid 텍스트 — 구현 전 선작성(Red).
//
// 여기서 만든 텍스트는 화면에 그대로 보여 주고 사용자가 고칠 수 있게 한다.
// 그래서 "돌아가기만 하면 되는" 문자열이 아니라 **읽을 수 있는 문서**여야 한다.
//
// mermaid 문법에는 그냥 넣으면 깨지는 자리가 여럿이다.
//   · ER 속성의 타입에 괄호·쉼표가 들어가면 파서가 죽는다  varchar(255) → varchar_255_
//   · 클래스 다이어그램의 제네릭은 꺾쇠가 아니라 물결이다   List<Order> → List~Order~
//   · 예약어를 이름으로 쓰면 파서가 죽는다                  class → class_
// 이걸 놓치면 "코드 붙여넣으면 그림이 나온다" 는 약속이 조용히 깨진다.
import { describe, it, expect } from "vitest";
import { toErMermaid, toClassMermaid } from "../diagram/toMermaid.js";

const erModel = {
  entities: [
    {
      name: "member", kind: "table",
      fields: [
        { name: "id", type: "BIGINT", pk: true, nullable: false },
        { name: "email", type: "VARCHAR(255)", unique: true, nullable: false },
        { name: "memo", type: "TEXT", nullable: true },
      ],
    },
    {
      name: "orders", kind: "table",
      fields: [
        { name: "id", type: "BIGINT", pk: true },
        { name: "member_id", type: "BIGINT", fk: true },
        { name: "amount", type: "DECIMAL(12,2)" },
      ],
    },
  ],
  relations: [{ from: "member", to: "orders", kind: "fk", fromCard: "1", toCard: "N", label: "member_id" }],
  warnings: [],
};

describe("toErMermaid", () => {
  const out = toErMermaid(erModel);

  it("erDiagram 으로 시작한다", () => {
    expect(out.split("\n")[0].trim()).toBe("erDiagram");
  });

  it("테이블과 컬럼이 전부 들어간다", () => {
    expect(out).toContain("member {");
    expect(out).toContain("orders {");
    expect(out).toContain("id");
    expect(out).toContain("email");
  });

  it("PK · FK · UK 를 표시한다", () => {
    expect(out).toMatch(/id\s+PK/);
    expect(out).toMatch(/email\s+UK/);
    expect(out).toMatch(/member_id\s+FK/);
  });

  it("타입의 괄호와 쉼표를 걷어낸다 — 넣으면 mermaid 파서가 죽는다", () => {
    expect(out).not.toContain("VARCHAR(255)");
    expect(out).not.toContain("DECIMAL(12,2)");
    expect(out).toMatch(/varchar_255_|varchar/i);
  });

  it("1:N 을 mermaid 기수 기호로 옮긴다", () => {
    // 부모 ||--o{ 자식
    expect(out).toMatch(/member\s+\|\|--o\{\s+orders/);
  });

  it("관계에 이름을 붙인다 — mermaid 는 라벨이 없으면 문법 오류다", () => {
    const line = out.split("\n").find((l) => l.includes("||--o{"));
    expect(line).toMatch(/:\s*"?[^"\n]+"?\s*$/);
  });

  it("빈 모델이면 안내가 담긴 텍스트를 준다 — 빈 문자열로 화면을 비우지 않는다", () => {
    const t = toErMermaid({ entities: [], relations: [], warnings: [] });
    expect(t).toContain("erDiagram");
  });
});

const classModel = {
  entities: [
    {
      name: "Member", kind: "class",
      fields: [
        { name: "id", type: "Long", visibility: "-", pk: true },
        { name: "orders", type: "List<Order>", visibility: "-" },
      ],
      methods: [
        { name: "getEmail", returns: "String", params: "", visibility: "+" },
        { name: "rename", returns: "void", params: "String name", visibility: "#" },
      ],
    },
    { name: "Order", kind: "class", fields: [{ name: "id", type: "Long", visibility: "-" }], methods: [] },
    { name: "Payable", kind: "interface", fields: [], methods: [{ name: "pay", returns: "void", params: "long amount", visibility: "+" }] },
    { name: "Status", kind: "enum", fields: [{ name: "READY", type: "" }, { name: "PAID", type: "" }], methods: [] },
  ],
  relations: [
    { from: "BaseEntity", to: "Member", kind: "extends" },
    { from: "Payable", to: "Order", kind: "implements" },
    { from: "Member", to: "Order", kind: "association", label: "OneToMany", fromCard: "1", toCard: "N" },
  ],
  warnings: [],
};

describe("toClassMermaid", () => {
  const out = toClassMermaid(classModel);

  it("classDiagram 으로 시작한다", () => {
    expect(out.split("\n")[0].trim()).toBe("classDiagram");
  });

  it("접근 제어자를 그대로 쓴다", () => {
    expect(out).toContain("-Long id");
    expect(out).toContain("+getEmail()");
  });

  it("제네릭을 물결표로 바꾼다 — 꺾쇠를 그대로 두면 깨진다", () => {
    expect(out).toContain("List~Order~");
    expect(out).not.toContain("List<Order>");
  });

  it("메서드의 반환 타입을 뒤에 쓴다", () => {
    expect(out).toMatch(/\+getEmail\(\)\s+String/);
    expect(out).toMatch(/#rename\(String name\)\s+void/);
  });

  it("interface 와 enum 에 표시를 붙인다", () => {
    expect(out).toContain("<<interface>>");
    expect(out).toContain("<<enumeration>>");
  });

  it("상속은 <|-- 로 그린다", () => {
    expect(out).toMatch(/BaseEntity\s+<\|--\s+Member/);
  });

  it("구현은 <|.. 로 그린다 — 상속과 선 모양이 달라야 한다", () => {
    expect(out).toMatch(/Payable\s+<\|\.\.\s+Order/);
  });

  it("연관은 화살표로 그리고 개수를 붙인다", () => {
    const line = out.split("\n").find((l) => l.includes("Member") && l.includes("Order") && l.includes("-->"));
    expect(line).toContain('"1"');
    expect(line).toContain('"N"');
    expect(line).toContain("OneToMany");
  });

  // mermaid 는 classDiagram 에 주석만 있으면 문법 오류를 낸다(erDiagram 은 받아 준다).
  // 실물 파서에 먹여 보고서야 알았다 — 문자열 단언만으로는 안 걸리는 종류의 버그다.
  it("빈 모델이어도 상자를 하나는 그린다 — 주석만 있으면 mermaid 가 거부한다", () => {
    const t = toClassMermaid({ entities: [], relations: [], warnings: [] });
    expect(t).toMatch(/^\s*class\s+\S+\s*\{/m);
  });

  it("mermaid 예약어와 부딪히는 이름을 피한다", () => {
    const t = toClassMermaid({
      entities: [{ name: "class", kind: "class", fields: [], methods: [] }],
      relations: [], warnings: [],
    });
    expect(t).not.toMatch(/^\s*class class\s*\{/m);
  });

  it("이름에 점이 있으면 떼어 낸다 — com.example.Member 는 문법 오류다", () => {
    const t = toClassMermaid({
      entities: [{ name: "com.example.Member", kind: "class", fields: [], methods: [] }],
      relations: [], warnings: [],
    });
    expect(t).not.toContain("com.example.Member");
    expect(t).toContain("Member");
  });
});
