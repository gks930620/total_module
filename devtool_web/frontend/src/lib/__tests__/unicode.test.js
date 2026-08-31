// 유니코드·한글 분석 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { inspectChars, decomposeHangul, composeHangul, extractChoseong, extractJungseong, decomposeToJamo } from "../unicode.js";

describe("inspectChars", () => {
  it("코드포인트와 이스케이프 표기를 준다", () => {
    const [a] = inspectChars("A");
    expect(a.codePoint).toBe(65);
    expect(a.hex).toBe("U+0041");
    expect(a.jsEscape).toBe("\\u0041");
    expect(a.htmlEntity).toBe("&#65;");
  });

  it("UTF-8 바이트를 보여준다", () => {
    const [h] = inspectChars("한");
    expect(h.utf8).toBe("ED 95 9C");
    expect(h.utf8Length).toBe(3);
  });

  it("BMP 밖 문자(이모지)를 서로게이트 쌍이 아니라 하나로 센다", () => {
    const chars = inspectChars("😀");
    expect(chars).toHaveLength(1);
    expect(chars[0].codePoint).toBe(128512);
    expect(chars[0].hex).toBe("U+1F600");
  });

  it("여러 글자를 순서대로 준다", () => {
    expect(inspectChars("ab").map((c) => c.char)).toEqual(["a", "b"]);
  });

  it("빈 문자열은 빈 배열", () => {
    expect(inspectChars("")).toEqual([]);
  });
});

describe("decomposeHangul", () => {
  it("완성형 한글을 초·중·종성으로 쪼갠다", () => {
    expect(decomposeHangul("한")).toEqual([
      { char: "한", cho: "ㅎ", jung: "ㅏ", jong: "ㄴ", isHangul: true },
    ]);
  });

  it("종성이 없으면 빈 문자열", () => {
    expect(decomposeHangul("가")[0].jong).toBe("");
  });

  it("겹받침을 다룬다", () => {
    expect(decomposeHangul("닭")[0].jong).toBe("ㄺ");
  });

  it("한글이 아니면 그대로 통과시킨다", () => {
    expect(decomposeHangul("A")[0].isHangul).toBe(false);
  });
});

describe("composeHangul", () => {
  it("자모를 합쳐 완성형을 만든다", () => {
    expect(composeHangul("ㅎ", "ㅏ", "ㄴ")).toBe("한");
    expect(composeHangul("ㄱ", "ㅏ", "")).toBe("가");
  });
});

describe("extractChoseong", () => {
  it("초성만 뽑는다(초성 검색용)", () => {
    expect(extractChoseong("한글검색")).toBe("ㅎㄱㄱㅅ");
  });

  it("한글이 아닌 문자는 그대로 둔다", () => {
    expect(extractChoseong("API 문서")).toBe("API ㅁㅅ");
  });
});

describe("extractJungseong — 모음(중성)만 뽑는다", () => {
  it("음절마다 중성만 남긴다", () => {
    expect(extractJungseong("한글")).toBe("ㅏㅡ");
  });

  it("겹모음도 한 글자로 낸다", () => {
    expect(extractJungseong("희왜")).toBe("ㅢㅙ");
  });

  it("한글이 아닌 글자는 그대로 둔다", () => {
    expect(extractJungseong("한 A글")).toBe("ㅏ Aㅡ");
  });
});

describe("decomposeToJamo — 자모로 풀어쓴다", () => {
  it("종성이 없으면 두 자, 있으면 세 자다", () => {
    expect(decomposeToJamo("희")).toBe("ㅎㅢ");
    expect(decomposeToJamo("한")).toBe("ㅎㅏㄴ");
  });

  it("겹받침은 한 글자로 둔다", () => {
    expect(decomposeToJamo("값")).toBe("ㄱㅏㅄ");
  });

  it("한글이 아닌 글자는 그대로 둔다", () => {
    expect(decomposeToJamo("A한!")).toBe("Aㅎㅏㄴ!");
  });
});
