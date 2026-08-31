// 정규식 테스터 계약 테스트 (RGX-01~03) — 구현보다 먼저 작성(TDD Red).
// 전부 클라이언트 처리. 무한루프(제로길이 매치) 방어와 매치 상한이 핵심 안전장치.
import { describe, it, expect } from "vitest";
import { compileRegex, findMatches, buildSegments, REGEX_PRESETS } from "../regexTester.js";

describe("compileRegex", () => {
  it("정상 패턴은 RegExp를 반환한다", () => {
    const { regex, error } = compileRegex("a+", "gi");
    expect(error).toBeNull();
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex.flags).toContain("g");
  });

  it("문법 오류는 한국어 안내와 함께 error를 반환한다 (RGX-01 오류 인라인)", () => {
    const { regex, error } = compileRegex("(", "g");
    expect(regex).toBeNull();
    expect(error).toMatch(/정규식/);
  });
});

describe("findMatches", () => {
  it("g 플래그면 모든 매치를 위치와 함께 반환한다", () => {
    const { matches } = findMatches("a+", "g", "aaa bb aa");
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ start: 0, end: 3, text: "aaa" });
    expect(matches[1]).toMatchObject({ start: 7, end: 9, text: "aa" });
  });

  it("g 플래그가 없으면 첫 매치만 반환한다", () => {
    const { matches } = findMatches("a+", "", "aaa bb aa");
    expect(matches).toHaveLength(1);
  });

  it("캡처 그룹을 배열로 제공한다 (RGX-02)", () => {
    const { matches } = findMatches("(\\d{3})-(\\d{4})", "g", "전화 010-1234 끝");
    expect(matches[0].groups).toEqual(["010", "1234"]);
  });

  it("제로 길이 매치에서도 무한루프 없이 종료한다", () => {
    const { matches } = findMatches("a*", "g", "bbb");
    expect(Array.isArray(matches)).toBe(true); // 각 위치의 빈 매치 — 멈추지 않는 것이 핵심
  });

  it("maxMatches 초과 시 truncated=true", () => {
    const { matches, truncated } = findMatches("\\d", "g", "123456789012", { maxMatches: 5 });
    expect(matches).toHaveLength(5);
    expect(truncated).toBe(true);
  });

  it("잘못된 패턴이면 error를 담아 반환한다", () => {
    const { matches, error } = findMatches("(", "g", "abc");
    expect(matches).toHaveLength(0);
    expect(error).toBeTruthy();
  });
});

describe("buildSegments (하이라이트 렌더용)", () => {
  it("텍스트를 매치/비매치 구간으로 나눈다", () => {
    const { matches } = findMatches("a+", "g", "xxaaxx");
    const segs = buildSegments("xxaaxx", matches);
    expect(segs).toEqual([
      { text: "xx", matched: false },
      { text: "aa", matched: true, matchIndex: 0 },
      { text: "xx", matched: false },
    ]);
  });

  it("매치가 없으면 전체가 비매치 1구간", () => {
    expect(buildSegments("abc", [])).toEqual([{ text: "abc", matched: false }]);
  });
});

describe("REGEX_PRESETS (한국 특화 프리셋, RGX-03)", () => {
  const byKey = Object.fromEntries(REGEX_PRESETS.map((p) => [p.key, p]));

  it("휴대폰·이메일·사업자번호·우편번호·한글만 5종을 제공한다", () => {
    expect(Object.keys(byKey)).toEqual(
      expect.arrayContaining(["phone", "email", "bizno", "zipcode", "hangul"])
    );
    for (const p of REGEX_PRESETS) {
      expect(p.label).toBeTruthy();
      expect(p.sample).toBeTruthy();
      // 프리셋 패턴은 자체 컴파일이 가능해야 한다
      expect(compileRegex(p.pattern, "g").error).toBeNull();
    }
  });

  it("휴대폰 프리셋이 대표 형식을 매치한다", () => {
    const p = byKey.phone;
    expect(findMatches(p.pattern, "g", "010-1234-5678").matches.length).toBeGreaterThan(0);
    expect(findMatches(p.pattern, "g", "01012345678").matches.length).toBeGreaterThan(0);
  });

  it("사업자번호 프리셋이 000-00-00000 형식을 매치한다", () => {
    const p = byKey.bizno;
    expect(findMatches(p.pattern, "g", "120-81-47521").matches.length).toBeGreaterThan(0);
  });

  it("한글만 프리셋은 섞인 문장에서 완성형 한글 덩어리만 뽑는다", () => {
    const p = byKey.hangul;
    const got = findMatches(p.pattern, "g", "한글만 골라내기 ㅋㅋ English 123 초성ㅎ")
      .matches.map((m) => m.text);
    // 영문·숫자는 빠지고, 자음 홑글자(ㅋ ㅎ)도 [가-힣] 범위 밖이라 빠진다
    expect(got).toEqual(["한글만", "골라내기", "초성"]);
  });
});
