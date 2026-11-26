// 정적 법적 문서로 가는 주소 — 앱에서 고른 언어로 열려야 한다.
// (QA 2026-11-26: 앱을 영어로 바꿔도 한국어 브라우저면 약관이 한국어로 열리던 결함)
import { describe, it, expect } from "vitest";
import { legalDocUrl } from "../legal.js";

describe("legalDocUrl", () => {
  it("한국어 화면은 한국어 문서로", () => {
    expect(legalDocUrl("/terms.html", "ko")).toBe("/terms.html?lang=ko");
  });

  it("그 밖의 언어는 영어 문서로 — 문서는 한국어·영어 두 가지뿐이다", () => {
    for (const lang of ["en", "ja", "zh", "es", "de"]) {
      expect(legalDocUrl("/privacy.html", lang), lang).toBe("/privacy.html?lang=en");
    }
  });

  it("조항으로 바로 간다 — 영어 본문의 앵커는 -en 이 붙는다(terms.html)", () => {
    expect(legalDocUrl("/terms.html", "ko", "refund")).toBe("/terms.html?lang=ko#refund");
    expect(legalDocUrl("/terms.html", "ja", "refund")).toBe("/terms.html?lang=en#refund-en");
  });
});
