// 색상 변환 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { contrastAdvice, parseColor, toHex, toRgbString, toHslString, luminance, contrastRatio, wcagLevel } from "../color.js";

describe("parseColor", () => {
  it("#RRGGBB 를 파싱한다", () => {
    expect(parseColor("#3B82F6")).toMatchObject({ ok: true, r: 59, g: 130, b: 246, a: 1 });
  });

  it("#RGB 축약형을 확장한다", () => {
    expect(parseColor("#f00")).toMatchObject({ r: 255, g: 0, b: 0 });
  });

  it("#RRGGBBAA 의 알파를 읽는다", () => {
    expect(parseColor("#ff000080").a).toBeCloseTo(0.502, 2);
  });

  it("rgb() / rgba() 를 파싱한다", () => {
    expect(parseColor("rgb(59, 130, 246)")).toMatchObject({ r: 59, g: 130, b: 246 });
    expect(parseColor("rgba(0,0,0,0.5)")).toMatchObject({ r: 0, a: 0.5 });
  });

  it("hsl() 을 파싱한다", () => {
    expect(parseColor("hsl(0, 100%, 50%)")).toMatchObject({ r: 255, g: 0, b: 0 });
  });

  it("# 없는 hex 도 받아준다", () => {
    expect(parseColor("3B82F6")).toMatchObject({ r: 59 });
  });

  it("이름 있는 색을 안다", () => {
    expect(parseColor("red")).toMatchObject({ r: 255, g: 0, b: 0 });
  });

  it("해석 불가면 ok:false", () => {
    expect(parseColor("헬로").ok).toBe(false);
    expect(parseColor("").ok).toBe(false);
  });
});

describe("출력 포맷", () => {
  const c = parseColor("#3B82F6");

  it("hex 로 출력한다", () => {
    expect(toHex(c)).toBe("#3b82f6");
  });

  it("알파가 있으면 8자리 hex", () => {
    expect(toHex(parseColor("rgba(255,0,0,0.5)"))).toBe("#ff000080");
  });

  it("rgb 문자열로 출력한다", () => {
    expect(toRgbString(c)).toBe("rgb(59, 130, 246)");
  });

  it("hsl 문자열로 출력한다", () => {
    expect(toHslString(parseColor("#ff0000"))).toBe("hsl(0, 100%, 50%)");
  });

  // hsl() 출력은 CSS 관례대로 정수로 반올림하므로 라운드트립에 미세 오차가 생긴다.
  // 이는 사양상 불가피하며(정수 HSL 은 24비트 RGB 를 전부 표현하지 못함) 채널당 ±2 이내여야 한다.
  it("hex → hsl → hex 는 정수 반올림 오차 범위 안이다", () => {
    const back = parseColor(toHslString(parseColor("#3b82f6")));
    expect(Math.abs(back.r - 59)).toBeLessThanOrEqual(2);
    expect(Math.abs(back.g - 130)).toBeLessThanOrEqual(2);
    expect(Math.abs(back.b - 246)).toBeLessThanOrEqual(2);
  });

  it("hex → rgb → hex 는 무손실이다", () => {
    expect(toHex(parseColor(toRgbString(parseColor("#3b82f6"))))).toBe("#3b82f6");
  });
});

describe("접근성(WCAG)", () => {
  it("흑백의 상대 휘도", () => {
    expect(luminance(parseColor("#ffffff"))).toBeCloseTo(1, 5);
    expect(luminance(parseColor("#000000"))).toBeCloseTo(0, 5);
  });

  it("흑백 대비는 21:1", () => {
    expect(contrastRatio(parseColor("#000"), parseColor("#fff"))).toBeCloseTo(21, 2);
  });

  it("같은 색 대비는 1:1", () => {
    expect(contrastRatio(parseColor("#3b82f6"), parseColor("#3b82f6"))).toBeCloseTo(1, 5);
  });

  it("등급을 판정한다", () => {
    expect(wcagLevel(21)).toBe("AAA");
    expect(wcagLevel(5)).toBe("AA");
    expect(wcagLevel(2)).toBe("실패");
  });
});

describe("contrastAdvice — 그래서 어떻게 하라는 건지 한 줄로", () => {
  it("7 이상이면 다 통과", () => {
    expect(contrastAdvice(21)).toBe("본문·큰 글씨 모두 넉넉히 통과합니다.");
  });

  it("4.5 이상이면 본문 통과", () => {
    expect(contrastAdvice(5)).toBe("본문에 써도 됩니다. 7 이상이면 AAA 입니다.");
  });

  it("3 이상 4.5 미만이면 큰 글씨만", () => {
    expect(contrastAdvice(3.68)).toBe("큰 글씨(굵은 19px 이상)에만 쓸 수 있습니다. 본문에 쓰려면 4.5 이상으로 올리세요.");
  });

  it("3 미만이면 어디에도 못 쓴다", () => {
    expect(contrastAdvice(1.57)).toBe("어디에도 쓰기 어렵습니다. 글자색을 더 진하게 하거나 배경을 더 밝게 하세요.");
  });

  it("경계값은 통과 쪽이다", () => {
    expect(contrastAdvice(4.5)).toContain("본문에 써도");
    expect(contrastAdvice(3)).toContain("큰 글씨");
    expect(contrastAdvice(7)).toContain("넉넉히");
  });
});
