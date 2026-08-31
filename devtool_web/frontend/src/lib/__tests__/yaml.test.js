// JSON ↔ YAML 변환 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { toYaml, fromYaml } from "../yaml.js";

describe("toYaml", () => {
  it("평면 객체를 key: value 로 쓴다", () => {
    expect(toYaml({ name: "dev", port: 8080, debug: true, extra: null })).toBe(
      "name: dev\nport: 8080\ndebug: true\nextra: null"
    );
  });

  it("중첩 객체를 들여쓰기로 표현한다", () => {
    expect(toYaml({ server: { host: "localhost", port: 80 } })).toBe(
      "server:\n  host: localhost\n  port: 80"
    );
  });

  it("스칼라 배열을 - 목록으로 쓴다", () => {
    expect(toYaml({ tags: ["a", "b"] })).toBe("tags:\n  - a\n  - b");
  });

  it("객체 배열을 - 아래 들여쓰기로 쓴다", () => {
    expect(toYaml({ items: [{ id: 1, name: "x" }] })).toBe(
      "items:\n  - id: 1\n    name: x"
    );
  });

  it("빈 객체·빈 배열은 flow 표기로 쓴다", () => {
    expect(toYaml({ a: {}, b: [] })).toBe("a: {}\nb: []");
  });

  it("특수문자가 있는 문자열은 따옴표로 감싼다", () => {
    expect(toYaml({ a: "has: colon" })).toBe('a: "has: colon"');
    expect(toYaml({ a: "123" })).toBe('a: "123"');
    expect(toYaml({ a: "true" })).toBe('a: "true"');
  });

  it("여러 줄 문자열은 블록 스칼라로 쓴다", () => {
    expect(toYaml({ script: "line1\nline2" })).toBe("script: |-\n  line1\n  line2");
  });

  it("한글은 따옴표 없이 그대로 쓴다", () => {
    expect(toYaml({ 이름: "홍길동" })).toBe("이름: 홍길동");
  });
});

describe("fromYaml", () => {
  it("평면 매핑을 파싱한다", () => {
    expect(fromYaml("name: dev\nport: 8080\ndebug: true\nextra: null")).toEqual({
      name: "dev",
      port: 8080,
      debug: true,
      extra: null,
    });
  });

  it("중첩 매핑을 파싱한다", () => {
    expect(fromYaml("server:\n  host: localhost\n  port: 80")).toEqual({
      server: { host: "localhost", port: 80 },
    });
  });

  it("시퀀스를 파싱한다", () => {
    expect(fromYaml("tags:\n  - a\n  - b")).toEqual({ tags: ["a", "b"] });
  });

  it("객체 시퀀스를 파싱한다", () => {
    expect(fromYaml("items:\n  - id: 1\n    name: x\n  - id: 2\n    name: y")).toEqual({
      items: [
        { id: 1, name: "x" },
        { id: 2, name: "y" },
      ],
    });
  });

  it("주석과 문서 구분자를 무시한다", () => {
    expect(fromYaml("---\n# 설명\nkey: 1  # 뒤 주석")).toEqual({ key: 1 });
  });

  it("따옴표 문자열의 타입을 보존한다", () => {
    expect(fromYaml('a: "123"\nb: 123')).toEqual({ a: "123", b: 123 });
  });

  it("flow 표기를 파싱한다", () => {
    expect(fromYaml("a: [1, 2]\nb: {x: 1}")).toEqual({ a: [1, 2], b: { x: 1 } });
  });

  it("블록 스칼라를 파싱한다", () => {
    expect(fromYaml("script: |-\n  line1\n  line2")).toEqual({ script: "line1\nline2" });
  });

  it("라운드트립이 성립한다", () => {
    const obj = {
      apiVersion: "v1",
      metadata: { name: "svc", labels: { app: "web" } },
      ports: [{ port: 80, name: "http" }],
      enabled: true,
      replicas: 3,
    };
    expect(fromYaml(toYaml(obj))).toEqual(obj);
  });

  it("들여쓰기가 어긋나면 오류를 던진다", () => {
    expect(() => fromYaml("a: 1\n  b: 2")).toThrow();
  });
});
