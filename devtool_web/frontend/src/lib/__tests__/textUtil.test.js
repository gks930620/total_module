// 텍스트 유틸 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { sortLines, dedupeLines, trimLines, removeEmptyLines, numberLines, reverseLines, textStats, wrapLines } from "../textUtil.js";

describe("sortLines", () => {
  it("사전순 오름/내림차순", () => {
    expect(sortLines("b\na\nc")).toBe("a\nb\nc");
    expect(sortLines("b\na\nc", { desc: true })).toBe("c\nb\na");
  });

  it("자연 정렬은 숫자를 수로 비교한다", () => {
    expect(sortLines("item10\nitem2\nitem1", { natural: true })).toBe("item1\nitem2\nitem10");
  });

  it("한글은 가나다순으로 정렬한다", () => {
    expect(sortLines("다\n가\n나")).toBe("가\n나\n다");
  });
});

describe("dedupeLines", () => {
  it("중복을 제거하고 순서를 보존한다", () => {
    expect(dedupeLines("a\nb\na\nc\nb")).toBe("a\nb\nc");
  });

  it("대소문자 무시 옵션", () => {
    expect(dedupeLines("A\na", { ignoreCase: true })).toBe("A");
  });
});

describe("정리 함수", () => {
  it("줄 양끝 공백을 제거한다", () => {
    expect(trimLines("  a  \n b")).toBe("a\nb");
  });

  it("빈 줄을 제거한다", () => {
    expect(removeEmptyLines("a\n\n\nb\n  \nc")).toBe("a\nb\nc");
  });

  it("줄 번호를 붙인다", () => {
    expect(numberLines("a\nb")).toBe("1. a\n2. b");
    expect(numberLines("a\nb", { start: 0, separator: ": " })).toBe("0: a\n1: b");
  });

  it("줄 순서를 뒤집는다", () => {
    expect(reverseLines("a\nb\nc")).toBe("c\nb\na");
  });

  it("지정 폭으로 줄바꿈한다", () => {
    expect(wrapLines("aaa bbb ccc", { width: 7 })).toBe("aaa bbb\nccc");
  });
});

describe("textStats", () => {
  it("글자·줄·단어·바이트를 센다", () => {
    const s = textStats("hello world\n한글");
    expect(s.lines).toBe(2);
    expect(s.words).toBe(3);
    expect(s.chars).toBe(14);
    expect(s.charsNoSpace).toBe(12);
    expect(s.bytes).toBe(18); // "hello world\n" 12 + 한글 6
  });

  it("빈 문자열", () => {
    const s = textStats("");
    expect(s.chars).toBe(0);
    expect(s.words).toBe(0);
    expect(s.lines).toBe(0);
  });

  it("이모지는 코드포인트 기준으로도 센다", () => {
    const s = textStats("👨‍👩‍👧");
    expect(s.chars).toBeGreaterThan(s.graphemes ?? 0);
  });
});
