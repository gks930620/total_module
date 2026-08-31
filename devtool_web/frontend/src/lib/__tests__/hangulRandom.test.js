// 무작위 한글 생성 계약 테스트 — 구현 전 선작성(Red).
//
// 문제: 한글 11,172자에서 균등하게 뽑으면 "뜃뭸퀥냺멛뤡" 같은 글자만 나온다.
// 그 11,172자의 대부분은 문법상 가능하지만 **실제로는 쓰이지 않는 조합**이기 때문이다.
// 더미데이터라 뜻은 없어도 되지만, 한국어처럼 보이기는 해야 한다.
import { describe, it, expect } from "vitest";
import { createField, generateRows } from "../dummy.js";

const koreanField = (length = 20) => ({
  ...createField("mysql", "VARCHAR", "s"),
  params: { length, charset: "korean" },
});

const sample = (rows = 200) =>
  generateRows([koreanField()], rows, { dialect: "mysql" }).map((r) => r.s).join("");

/** 한글 음절을 초성·중성·종성 인덱스로 쪼갠다 */
const parts = (ch) => {
  const i = ch.charCodeAt(0) - 0xac00;
  return { cho: Math.floor(i / (21 * 28)), jung: Math.floor((i % (21 * 28)) / 28), jong: i % 28 };
};

describe("무작위 한글 — 한국어처럼 보인다", () => {
  it("전부 완성형 한글 음절이다", () => {
    expect(sample()).toMatch(/^[가-힣]+$/);
  });

  it("거의 안 쓰는 겹받침이 나오지 않는다", () => {
    // ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅄ — 이것들이 "뜃뭸퀥" 같은 글자를 만든다
    const RARE_JONG = [3, 5, 6, 9, 10, 11, 12, 13, 14, 18];
    const found = [...sample()].filter((c) => RARE_JONG.includes(parts(c).jong));
    expect(found.slice(0, 10), `겹받침이 섞였다: ${found.slice(0, 10).join("")}`).toEqual([]);
  });

  it("거의 안 쓰는 이중모음이 나오지 않는다", () => {
    // ㅒㅖㅘㅙㅚㅝㅞㅟㅢ
    const RARE_JUNG = [3, 7, 9, 10, 11, 14, 15, 16, 19];
    const found = [...sample()].filter((c) => RARE_JUNG.includes(parts(c).jung));
    expect(found.slice(0, 10), `이중모음이 섞였다: ${found.slice(0, 10).join("")}`).toEqual([]);
  });

  it("된소리 초성(ㄲㄸㅃㅆㅉ)이 나오지 않는다", () => {
    const RARE_CHO = [1, 4, 8, 10, 13];
    const found = [...sample()].filter((c) => RARE_CHO.includes(parts(c).cho));
    expect(found.slice(0, 10), `된소리가 섞였다: ${found.slice(0, 10).join("")}`).toEqual([]);
  });

  it("받침이 있는 글자와 없는 글자가 섞인다", () => {
    // 전부 받침이면 "각난달" 처럼, 전혀 없으면 "가나다" 처럼 어색해진다
    const chars = [...sample()];
    const withJong = chars.filter((c) => parts(c).jong !== 0).length;
    const ratio = withJong / chars.length;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.75);
  });

  it("같은 글자만 반복되지 않는다 — 무작위여야 한다", () => {
    expect(new Set([...sample()]).size).toBeGreaterThan(80);
  });

  it("길이 제한을 지킨다", () => {
    const rows = generateRows([koreanField(6)], 50, { dialect: "mysql" });
    for (const r of rows) expect(r.s.length).toBeLessThanOrEqual(6);
  });

  it("Oracle 처럼 바이트로 세는 방언에서도 넘치지 않는다", () => {
    const f = { ...createField("oracle", "VARCHAR2", "s"), params: { length: 10, charset: "korean" } };
    const rows = generateRows([f], 50, { dialect: "oracle" });
    const enc = new TextEncoder();
    for (const r of rows) expect(enc.encode(r.s).length).toBeLessThanOrEqual(10);
  });
});

describe("다른 문자셋은 그대로다", () => {
  it("영문+숫자는 여전히 영숫자다", () => {
    const f = { ...createField("mysql", "VARCHAR", "s"), params: { length: 20, charset: "mixed" } };
    const out = generateRows([f], 50, { dialect: "mysql" }).map((r) => r.s).join("");
    expect(out).toMatch(/^[A-Za-z0-9]+$/);
  });
});
