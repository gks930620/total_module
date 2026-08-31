import { describe, it, expect } from "vitest";
import { countDetail, joinBrokenLines, cleanupText, compareLists } from "../textTools.js";

describe("countDetail", () => {
  it("공백 포함·제외 글자수를 나눠 센다", () => {
    // "안녕"(2) + 공백 + "하세요"(3) + 공백 + "abc"(3) = 10자, 공백 제외 8자
    const r = countDetail("안녕 하세요 abc");
    expect(r.chars).toBe(10);
    expect(r.charsNoSpace).toBe(8);
    expect(r.words).toBe(3);
  });

  it("문자 종류별로 센다", () => {
    const r = countDetail("한글abc123");
    expect(r.hangul).toBe(2);
    expect(r.latin).toBe(3);
    expect(r.digit).toBe(3);
  });

  it("원고지 매수를 계산한다(200자 1매)", () => {
    expect(countDetail("가".repeat(200)).manuscript200).toBe(1);
    expect(countDetail("가".repeat(201)).manuscript200).toBe(2);
    expect(countDetail("가".repeat(100)).manuscript200Exact).toBe(0.5);
  });

  it("보이지 않는 문자를 잡아낸다", () => {
    const r = countDetail("a​b c\td   \n다음");
    expect(r.invisible.zeroWidth).toBe(1);
    expect(r.invisible.nbsp).toBe(1);
    expect(r.invisible.tab).toBe(1);
    expect(r.invisible.trailingSpaceLines).toBe(1);
  });

  it("UTF-8 바이트를 센다(한글 3바이트)", () => {
    expect(countDetail("한").bytesUtf8).toBe(3);
    expect(countDetail("a").bytesUtf8).toBe(1);
  });

  it("빈 문자열", () => {
    const r = countDetail("");
    expect(r.chars).toBe(0);
    expect(r.lines).toBe(0);
    expect(r.manuscript200).toBe(0);
  });
});

describe("joinBrokenLines", () => {
  it("문장이 안 끝난 줄은 이어붙인다", () => {
    const src = "이 논문은 기계학습을 이용한\n자연어 처리 기법을 다룬다.\n다음 장에서는";
    const out = joinBrokenLines(src);
    expect(out).toContain("이용한 자연어");
    // 마침표로 끝난 줄 뒤는 개행 유지
    expect(out).toContain("다룬다.\n다음");
  });

  it("문단 사이 빈 줄은 보존한다", () => {
    const out = joinBrokenLines("첫 문단\n이어짐\n\n둘째 문단");
    expect(out).toContain("\n\n둘째");
  });

  it("영문 하이픈 줄바꿈을 복구한다", () => {
    expect(joinBrokenLines("inter-\nnational")).toBe("international");
  });

  // PDF 줄바꿈은 대부분 띄어쓰기 자리에서 일어나므로 한글도 공백을 넣어야 한다
  it("한글도 공백을 넣어 붙인다", () => {
    expect(joinBrokenLines("가나\n다라")).toBe("가나 다라");
  });

  it("영문 사이에는 공백을 넣는다", () => {
    expect(joinBrokenLines("hello\nworld")).toBe("hello world");
  });

  it("띄어쓰기를 안 쓰는 한자·가나끼리는 붙인다", () => {
    expect(joinBrokenLines("漢字\n連結")).toBe("漢字連結");
  });

  it("목록 항목은 이어붙이지 않는다", () => {
    const out = joinBrokenLines("- 첫째 항목\n- 둘째 항목\n1. 번호 항목");
    expect(out).toBe("- 첫째 항목\n- 둘째 항목\n1. 번호 항목");
  });
});

describe("cleanupText", () => {
  it("연속 공백을 하나로", () => {
    expect(cleanupText("a    b")).toBe("a b");
  });
  it("보이지 않는 공백을 제거한다", () => {
    expect(cleanupText("a​b c")).toBe("ab c");
  });
  it("빈 줄 3개 이상은 2개로 줄인다", () => {
    expect(cleanupText("a\n\n\n\nb")).toBe("a\n\nb");
  });
  it("따옴표 정규화 옵션", () => {
    expect(cleanupText("“따옴표”", { normalizeQuotes: true })).toBe('"따옴표"');
  });
});

describe("compareLists", () => {
  const L = "사과\n바나나\n포도";
  const R = "바나나\n포도\n수박";

  it("교집합·차집합을 나눈다", () => {
    const r = compareLists(L, R);
    expect(r.both).toEqual(["바나나", "포도"]);
    expect(r.onlyLeft).toEqual(["사과"]);
    expect(r.onlyRight).toEqual(["수박"]);
  });

  it("각 목록의 중복을 알려 준다", () => {
    const r = compareLists("a\nb\na", "c");
    expect(r.leftDuplicates).toEqual(["a"]);
    expect(r.leftCount).toBe(3);
    expect(r.leftUnique).toBe(2);
  });

  it("대소문자 무시 옵션", () => {
    expect(compareLists("Apple", "apple", { ignoreCase: true }).both).toHaveLength(1);
    expect(compareLists("Apple", "apple").both).toHaveLength(0);
  });

  it("합집합을 준다", () => {
    expect(compareLists(L, R).union.sort()).toEqual(["바나나", "사과", "수박", "포도"]);
  });
});