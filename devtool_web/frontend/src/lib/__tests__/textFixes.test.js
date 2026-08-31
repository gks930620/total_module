// 텍스트 그룹 감사에서 나온 것들 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { diffLines, normalizeForDiff } from "../diff.js";
import { countDetail } from "../textTools.js";

// 이미 올바르게 동작한다(normalizeForDiff 가 줄바꿈을 통일한다). 회귀 방지로 남긴다 —
// 윈도·유닉스 파일을 비교할 때 전 줄이 다르게 보이면 도구가 쓸모없어진다.
// (감사 스크립트가 type 이름을 "same" 으로 잘못 짚어 버그로 보고했던 자리다. 실제 값은 "=" 다.)
describe("diff — 줄바꿈 방식이 다르다고 전부 다르다고 하면 안 된다", () => {
  it("CRLF 와 LF 만 다르면 차이가 없다", () => {
    const rows = diffLines("a\r\nb\r\nc", "a\nb\nc");
    expect(rows.every((r) => r.type === "=")).toBe(true);
  });

  it("옛 맥 방식(CR)도 같게 본다", () => {
    const rows = diffLines("a\rb", "a\nb");
    expect(rows.every((r) => r.type === "=")).toBe(true);
  });

  it("진짜 차이는 여전히 잡는다", () => {
    const rows = diffLines("a\r\nb", "a\nc");
    expect(rows.some((r) => r.type !== "=")).toBe(true);
  });

  it("normalizeForDiff 는 그대로 쓸 수 있다 (옵션이 필요할 때)", () => {
    expect(normalizeForDiff("A\r\nB", { ignoreCase: true })).toBe("a\nb");
  });
});

describe("countDetail — 사람이 보는 글자 수", () => {
  it("가족 이모지는 한 글자다", () => {
    // 👨‍👩‍👧 = 코드포인트 5개(이모지 3 + ZWJ 2). 사람 눈에는 하나다.
    expect(countDetail("👨‍👩‍👧").graphemes).toBe(1);
  });

  it("결합 문자도 한 글자다", () => {
    // e + U+0301 = é
    expect(countDetail("é").graphemes).toBe(1);
  });

  it("국기 이모지도 한 글자다", () => {
    expect(countDetail("🇰🇷").graphemes).toBe(1);
  });

  it("한글은 그대로 센다", () => {
    expect(countDetail("가나다").graphemes).toBe(3);
  });

  it("코드포인트 수는 따로 준다 — 개발자는 둘 다 필요하다", () => {
    const r = countDetail("👨‍👩‍👧");
    expect(r.codePoints).toBe(5);
    expect(r.chars).toBe(8);        // UTF-16 코드유닛
    expect(r.graphemes).toBe(1);    // 사람이 보는 글자
  });

  it("빈 문자열은 0 이다", () => {
    expect(countDetail("").graphemes).toBe(0);
  });

  it("섞여 있어도 센다", () => {
    expect(countDetail("가A1👨‍👩‍👧").graphemes).toBe(4);
  });
});
