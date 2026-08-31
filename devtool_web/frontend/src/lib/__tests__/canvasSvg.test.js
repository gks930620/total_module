// 그리기 → SVG 파일 문자열. 구현 전 선작성(Red).
// 화면 렌더와 별개로 이 함수가 내보내기를 담당한다 — 화면은 CSS 토큰을 쓰지만
// 파일은 어디서 열릴지 몰라 실제 색을 박아야 하고, 그래서 따로 두고 따로 검증한다.
import { describe, it, expect } from "vitest";
import { createDoc, addNode, addEdge } from "../canvas/model.js";
import { toSvgString } from "../canvas/exportSvg.js";

const flow = () => {
  let doc = createDoc("flowchart");
  let a, b;
  [doc, a] = addNode(doc, { kind: "start", x: 20, y: 20, label: "시작" });
  [doc, b] = addNode(doc, { kind: "step", x: 240, y: 20, label: "저장 & 종료" });
  [doc] = addEdge(doc, { from: a, to: b, label: "<확인>" });
  return doc;
};

describe("toSvgString", () => {
  it("완결된 SVG 문서다", () => {
    const s = toSvgString(flow());
    expect(s.startsWith("<svg")).toBe(true);
    expect(s.trimEnd().endsWith("</svg>")).toBe(true);
    expect(s).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("라벨의 & < > 를 이스케이프한다 — 안 하면 파일이 깨진다", () => {
    const s = toSvgString(flow());
    expect(s).toContain("&amp;");
    expect(s).toContain("&lt;확인&gt;");
    expect(s).not.toContain("<확인>");
  });

  it("CSS 변수를 쓰지 않는다 — 파일은 이 사이트 밖에서 열린다", () => {
    expect(toSvgString(flow())).not.toContain("var(--");
  });

  it("모든 노드를 그린다", () => {
    let doc = createDoc("er");
    [doc] = addNode(doc, { kind: "table", x: 0, y: 0, name: "member", fields: [{ name: "id", type: "BIGINT", pk: true }] });
    const s = toSvgString(doc);
    expect(s).toContain("member");
    expect(s).toContain("id");
  });

  it("빈 문서도 유효한 SVG 다", () => {
    const s = toSvgString(createDoc("flowchart"));
    expect(s.startsWith("<svg")).toBe(true);
  });
});
