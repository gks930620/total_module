// 텍스트 diff 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { diffLines, toSideBySide, diffStats, normalizeForDiff } from "../diff.js";

const types = (rows) => rows.map((r) => r.type).join("");

describe("diffLines", () => {
  it("완전히 같으면 전부 equal", () => {
    expect(types(diffLines("a\nb", "a\nb"))).toBe("==");
  });

  it("추가된 줄을 add 로 표시한다", () => {
    const rows = diffLines("a\nc", "a\nb\nc");
    expect(types(rows)).toBe("=+=");
    expect(rows[1].text).toBe("b");
    expect(rows[1].rightNo).toBe(2);
    expect(rows[1].leftNo).toBe(null);
  });

  it("삭제된 줄을 del 로 표시한다", () => {
    const rows = diffLines("a\nb\nc", "a\nc");
    expect(types(rows)).toBe("=-=");
    expect(rows[1].text).toBe("b");
    expect(rows[1].leftNo).toBe(2);
  });

  it("변경은 del + add 로 표현한다", () => {
    expect(types(diffLines("a\nX\nc", "a\nY\nc"))).toBe("=-+=");
  });

  it("행 번호가 양쪽에서 각각 증가한다", () => {
    const rows = diffLines("a\nb", "a\nB\nc");
    const eq = rows.find((r) => r.type === "=");
    expect(eq.leftNo).toBe(1);
    expect(eq.rightNo).toBe(1);
  });

  it("빈 입력을 다룬다", () => {
    expect(diffLines("", "")).toEqual([{ type: "=", text: "", leftNo: 1, rightNo: 1 }]);
    expect(types(diffLines("", "a"))).toBe("-+");
  });

  it("공통 부분이 없으면 전부 삭제 후 추가", () => {
    expect(types(diffLines("a\nb", "x\ny"))).toBe("--++");
  });
});

describe("normalizeForDiff", () => {
  it("옵션에 따라 공백을 무시한다", () => {
    expect(normalizeForDiff("a  b ", { ignoreWhitespace: true })).toBe("a b");
  });

  it("옵션에 따라 대소문자를 무시한다", () => {
    expect(normalizeForDiff("AbC", { ignoreCase: true })).toBe("abc");
  });

  it("CRLF 를 LF 로 통일한다", () => {
    expect(normalizeForDiff("a\r\nb")).toBe("a\nb");
  });
});

describe("diffStats", () => {
  it("추가·삭제·동일 줄 수를 센다", () => {
    const s = diffStats(diffLines("a\nb\nc", "a\nX\nc\nd"));
    expect(s).toEqual({ added: 2, removed: 1, equal: 2, changed: true });
  });

  it("동일하면 changed=false", () => {
    expect(diffStats(diffLines("a", "a")).changed).toBe(false);
  });
});

describe("toSideBySide — IDE 의 좌우 비교처럼 줄을 짝지운다", () => {
  const sbs = (l, r) => toSideBySide(diffLines(l, r));

  it("같은 줄은 양쪽 같은 행에 놓는다", () => {
    const rows = sbs("a", "a");
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("=");
    expect(rows[0].left.text).toBe("a");
    expect(rows[0].right.text).toBe("a");
  });

  it("바뀐 줄은 삭제와 추가를 한 행에 마주 놓는다", () => {
    const rows = sbs("a\nb", "a\nB");
    expect(rows).toHaveLength(2);
    expect(rows[1].type).toBe("~");
    expect(rows[1].left.text).toBe("b");
    expect(rows[1].right.text).toBe("B");
  });

  it("삭제만 있으면 오른쪽이 빈다", () => {
    const rows = sbs("a\nb", "a");
    expect(rows[1].type).toBe("-");
    expect(rows[1].left.text).toBe("b");
    expect(rows[1].right).toBeNull();
  });

  it("추가만 있으면 왼쪽이 빈다", () => {
    const rows = sbs("a", "a\nb");
    expect(rows[1].type).toBe("+");
    expect(rows[1].left).toBeNull();
    expect(rows[1].right.text).toBe("b");
  });

  it("개수가 안 맞으면 남는 쪽만 한쪽에 놓는다", () => {
    const rows = toSideBySide([
      { type: "-", text: "x", leftNo: 1, rightNo: null },
      { type: "-", text: "y", leftNo: 2, rightNo: null },
      { type: "+", text: "z", leftNo: null, rightNo: 1 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe("~");
    expect(rows[1].type).toBe("-");
    expect(rows[1].right).toBeNull();
  });

  it("양쪽 줄 번호를 그대로 들고 온다", () => {
    const rows = sbs("a\nb\nc", "a\nB\nc");
    expect(rows[2].left.leftNo).toBe(3);
    expect(rows[2].right.rightNo).toBe(3);
  });
});
