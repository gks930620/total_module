import { describe, it, expect } from "vitest";
import { UTM_FIELDS, buildUtmUrl, parseUtmUrl } from "../webTools.js";

describe("buildUtmUrl", () => {
  const params = { utm_source: "naver", utm_medium: "cpc", utm_campaign: "Spring Sale" };

  it("UTM 파라미터를 붙인다", () => {
    const r = buildUtmUrl("https://example.com/page", params);
    expect(r.ok).toBe(true);
    expect(r.url).toContain("utm_source=naver");
    expect(r.url).toContain("utm_campaign=spring_sale"); // 공백은 _, 소문자 통일
  });

  it("스킴이 없으면 https 를 붙인다", () => {
    expect(buildUtmUrl("example.com", params).url).toMatch(/^https:\/\/example\.com/);
  });

  it("필수 항목이 비면 경고한다", () => {
    const r = buildUtmUrl("https://a.com", { utm_source: "naver" });
    expect(r.missing).toEqual(["utm_medium", "utm_campaign"]);
    expect(r.warn).toContain("필수");
  });

  it("소문자 통일을 끌 수 있다", () => {
    const r = buildUtmUrl("https://a.com", { ...params, utm_campaign: "SpringSale" }, { lowercase: false });
    expect(r.url).toContain("utm_campaign=SpringSale");
  });

  it("기존 쿼리는 보존한다", () => {
    expect(buildUtmUrl("https://a.com/?id=1", params).url).toContain("id=1");
  });

  it("URL 이 아니면 실패", () => {
    expect(buildUtmUrl("", params).ok).toBe(false);
  });
});

describe("parseUtmUrl", () => {
  it("링크에서 UTM 을 뽑아내고 원본 링크를 준다", () => {
    const r = parseUtmUrl("https://a.com/p?utm_source=naver&utm_medium=cpc&id=1");
    expect(r.params.utm_source).toBe("naver");
    expect(r.found).toBe(2);
    expect(r.base).toContain("id=1");
    expect(r.base).not.toContain("utm_");
  });
});
