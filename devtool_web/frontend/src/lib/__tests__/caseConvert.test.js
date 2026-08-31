// 문자열 케이스 변환 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { splitWords, convertCase, convertAll, CASE_STYLES } from "../caseConvert.js";

describe("splitWords", () => {
  it("camelCase 를 쪼갠다", () => {
    expect(splitWords("userName")).toEqual(["user", "name"]);
  });

  it("snake_case / kebab-case / 공백을 쪼갠다", () => {
    expect(splitWords("user_name")).toEqual(["user", "name"]);
    expect(splitWords("user-name")).toEqual(["user", "name"]);
    expect(splitWords("user name")).toEqual(["user", "name"]);
    expect(splitWords("user.name")).toEqual(["user", "name"]);
  });

  it("연속 대문자(약어)를 하나의 단어로 본다", () => {
    expect(splitWords("XMLHttpRequest")).toEqual(["xml", "http", "request"]);
    expect(splitWords("parseJSON")).toEqual(["parse", "json"]);
    expect(splitWords("IOError")).toEqual(["io", "error"]);
  });

  it("숫자를 분리한다", () => {
    expect(splitWords("user2Name")).toEqual(["user", "2", "name"]);
    expect(splitWords("oauth2Token")).toEqual(["oauth", "2", "token"]);
  });

  it("한글은 하나의 단어로 유지한다", () => {
    expect(splitWords("사용자_이름")).toEqual(["사용자", "이름"]);
  });

  it("빈 입력은 빈 배열", () => {
    expect(splitWords("")).toEqual([]);
    expect(splitWords("   ")).toEqual([]);
  });
});

describe("convertCase", () => {
  const src = "user_name_id";

  it.each([
    ["camel", "userNameId"],
    ["pascal", "UserNameId"],
    ["snake", "user_name_id"],
    ["constant", "USER_NAME_ID"],
    ["kebab", "user-name-id"],
    ["train", "User-Name-Id"],
    ["dot", "user.name.id"],
    ["path", "user/name/id"],
    ["lower", "user name id"],
    ["upper", "USER NAME ID"],
    ["title", "User Name Id"],
    ["sentence", "User name id"],
  ])("%s 로 변환한다", (style, expected) => {
    expect(convertCase(src, style)).toBe(expected);
  });

  it("약어가 섞인 입력도 올바르게 변환한다", () => {
    expect(convertCase("XMLHttpRequest", "snake")).toBe("xml_http_request");
    expect(convertCase("XMLHttpRequest", "camel")).toBe("xmlHttpRequest");
  });

  it("여러 줄 입력은 줄 단위로 변환한다", () => {
    expect(convertCase("user_name\nemail_addr", "camel")).toBe("userName\nemailAddr");
  });
});

describe("convertAll", () => {
  it("모든 스타일을 한 번에 만든다", () => {
    const out = convertAll("helloWorld");
    expect(Object.keys(out)).toEqual(CASE_STYLES.map((s) => s.key));
    expect(out.snake).toBe("hello_world");
  });
});
