// 무료 한도 판정 — 등록 화면 진입 가드와 프로 화면 경고가 같은 규칙을 쓴다.
// (QA 2026-11-26: 주소의 ?limit=1 만 보고 경고하거나, 저장 직후 늘어난 장수로 가드가 다시 걸리던 결함)
import { describe, it, expect } from "vitest";
import { isAtCardLimit } from "../limits.js";

describe("isAtCardLimit", () => {
  it("무료 한도까지 쓰면 true", () => {
    expect(isAtCardLimit({ card_count: 3, card_limit: 3 })).toBe(true);
  });

  it("한도가 줄어 이미 넘친 경우도 true", () => {
    expect(isAtCardLimit({ card_count: 5, card_limit: 3 })).toBe(true);
  });

  it("한도가 남아 있으면 false", () => {
    expect(isAtCardLimit({ card_count: 2, card_limit: 3 })).toBe(false);
  });

  it("프로(한도 없음 = card_limit 이 null·없음)는 언제나 false", () => {
    expect(isAtCardLimit({ pro: true, lifetime: true, card_count: 50, card_limit: null })).toBe(false);
    expect(isAtCardLimit({ pro: true, card_count: 50 })).toBe(false);
  });

  it("자격을 아직 모르면 false — 화면이 막지 않는다(최종 판정은 서버의 CARD_LIMIT_EXCEEDED)", () => {
    expect(isAtCardLimit(null)).toBe(false);
    expect(isAtCardLimit(undefined)).toBe(false);
  });
});
