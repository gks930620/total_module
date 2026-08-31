// URL 인코더/디코더·쿼리스트링 파서 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import {
  encodeComponent,
  decodeComponent,
  encodeFull,
  decodeFull,
  parseUrl,
  parseQuery,
  buildQuery,
} from "../urlTool.js";

describe("encodeComponent / decodeComponent", () => {
  it("한글을 percent 인코딩한다", () => {
    expect(encodeComponent("한글")).toBe("%ED%95%9C%EA%B8%80");
    expect(decodeComponent("%ED%95%9C%EA%B8%80")).toBe("한글");
  });

  it("예약문자를 전부 인코딩한다(component)", () => {
    expect(encodeComponent("a=b&c d/e?f")).toBe("a%3Db%26c%20d%2Fe%3Ff");
  });

  it("잘못된 percent 시퀀스는 오류를 반환한다", () => {
    expect(() => decodeComponent("%ZZ")).toThrow();
  });
});

describe("encodeFull / decodeFull", () => {
  it("URL 구조 문자(:/?&=)는 보존한다", () => {
    expect(encodeFull("https://a.com/경로?q=값")).toBe(
      "https://a.com/%EA%B2%BD%EB%A1%9C?q=%EA%B0%92"
    );
  });

  it("라운드트립이 성립한다", () => {
    const s = "https://a.com/path?q=한글&r=1";
    expect(decodeFull(encodeFull(s))).toBe(s);
  });
});

describe("parseUrl", () => {
  it("URL을 구성요소로 분해한다", () => {
    const u = parseUrl("https://user:pw@example.com:8443/a/b?x=1&y=2#frag");
    expect(u.ok).toBe(true);
    expect(u.protocol).toBe("https:");
    expect(u.host).toBe("example.com:8443");
    expect(u.hostname).toBe("example.com");
    expect(u.port).toBe("8443");
    expect(u.pathname).toBe("/a/b");
    expect(u.search).toBe("?x=1&y=2");
    expect(u.hash).toBe("#frag");
    expect(u.username).toBe("user");
  });

  it("스킴이 없으면 실패를 알린다", () => {
    expect(parseUrl("example.com/a").ok).toBe(false);
  });
});

describe("parseQuery", () => {
  it("쿼리스트링을 키/값 배열로 분해하고 디코딩한다", () => {
    const rows = parseQuery("?name=%ED%99%8D%EA%B8%B8%EB%8F%99&age=30");
    expect(rows).toEqual([
      { key: "name", value: "홍길동", raw: "%ED%99%8D%EA%B8%B8%EB%8F%99" },
      { key: "age", value: "30", raw: "30" },
    ]);
  });

  it("같은 키가 여러 번 나와도 전부 보존한다", () => {
    const rows = parseQuery("tag=a&tag=b");
    expect(rows.map((r) => r.value)).toEqual(["a", "b"]);
  });

  it("값 없는 키와 빈 문자열을 구분한다", () => {
    expect(parseQuery("flag&empty=")).toEqual([
      { key: "flag", value: null, raw: null },
      { key: "empty", value: "", raw: "" },
    ]);
  });

  it("+ 는 공백으로 해석한다", () => {
    expect(parseQuery("q=hello+world")[0].value).toBe("hello world");
  });

  it("URL 전체를 넣어도 쿼리 부분만 파싱한다", () => {
    expect(parseQuery("https://a.com/p?x=1")).toEqual([{ key: "x", value: "1", raw: "1" }]);
  });
});

describe("buildQuery", () => {
  it("키/값 배열을 쿼리스트링으로 조립한다", () => {
    expect(buildQuery([{ key: "q", value: "한글" }, { key: "p", value: "1" }])).toBe(
      "q=%ED%95%9C%EA%B8%80&p=1"
    );
  });

  it("값이 null 인 키는 = 없이 넣는다", () => {
    expect(buildQuery([{ key: "flag", value: null }])).toBe("flag");
  });
});
