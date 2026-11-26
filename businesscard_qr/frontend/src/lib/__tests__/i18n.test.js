// 다국어 계약 — 앱과 같은 6개 언어. 앱의 규칙(한국어=명함QR, 나머지=Businesscard QR)을 그대로 따른다.
import { describe, it, expect } from "vitest";
import { SUPPORTED_LANGUAGES, formatPrice, pickLanguage, translate } from "../i18n.js";

describe("pickLanguage", () => {
  it("6개 언어를 지원한다", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["ko", "en", "ja", "zh", "es", "de"]);
  });

  it("사용자가 고른 언어가 있으면 그걸 쓴다", () => {
    expect(pickLanguage(["ko-KR"], "de")).toBe("de");
  });

  it("고른 언어가 지원 목록에 없으면 무시한다 — 저장값이 깨져도 화면은 뜬다", () => {
    expect(pickLanguage(["ja-JP"], "xx")).toBe("ja");
  });

  it("브라우저 언어 태그의 지역 부분을 떼고 맞춘다", () => {
    expect(pickLanguage(["zh-CN"], null)).toBe("zh");
    expect(pickLanguage(["es-MX"], null)).toBe("es");
    expect(pickLanguage(["de-AT"], null)).toBe("de");
  });

  it("브라우저 선호 언어를 순서대로 본다", () => {
    expect(pickLanguage(["fr-FR", "ja-JP", "en"], null)).toBe("ja");
  });

  it("지원하지 않는 언어만 있으면 영어로 떨어진다", () => {
    expect(pickLanguage(["fr-FR", "it-IT"], null)).toBe("en");
    expect(pickLanguage([], null)).toBe("en");
  });
});

describe("translate", () => {
  const ko = {
    hello: "안녕 {name}",
    cards_other: "{count}장",
  };
  const en = {
    hello: "Hello {name}",
    onlyEnglish: "only in english",
    cards_one: "{count} card",
    cards_other: "{count} cards",
  };

  it("자리표시자에 값을 끼워 넣는다", () => {
    expect(translate("ko", ko, en, "hello", { name: "길동" })).toBe("안녕 길동");
  });

  it("현재 언어에 없는 키는 영어 문장으로 대신한다 — 빈칸보다 낫다", () => {
    expect(translate("ko", ko, en, "onlyEnglish")).toBe("only in english");
  });

  it("어디에도 없는 키는 키 이름을 보여준다 — 조용히 사라지지 않고 눈에 띄게", () => {
    expect(translate("ko", ko, en, "missingKey")).toBe("missingKey");
  });

  it("복수형은 언어 규칙대로 고른다 — 영어 1은 단수", () => {
    expect(translate("en", en, en, "cards", { count: 1 })).toBe("1 card");
    expect(translate("en", en, en, "cards", { count: 3 })).toBe("3 cards");
  });

  it("단수형이 없는 언어(한국어)는 other 를 쓴다", () => {
    expect(translate("ko", ko, en, "cards", { count: 1 })).toBe("1장");
  });

  it("값에 들어 있는 { } 는 다시 치환하지 않는다 — 사용자 입력을 끼워도 안전하다", () => {
    expect(translate("ko", ko, en, "hello", { name: "{count}" })).toBe("안녕 {count}");
  });
});

describe("formatPrice", () => {
  it("한국어는 '9,900원' — 국내에서 가장 익숙한 표기", () => {
    expect(formatPrice("ko", 9900, "KRW")).toBe("9,900원");
  });

  it("다른 언어는 그 언어의 통화 표기를 따른다", () => {
    expect(formatPrice("en", 9900, "KRW")).toBe("₩9,900");
  });

  it("값이 없으면 빈 문자열 — 가격을 못 받았을 때 'NaN원' 이 보이지 않게", () => {
    expect(formatPrice("ko", undefined, "KRW")).toBe("");
  });
});
