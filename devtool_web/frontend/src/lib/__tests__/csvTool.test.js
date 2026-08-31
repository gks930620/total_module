import { describe, it, expect } from "vitest";
import {
  detectDelimiter, parseCsv, toCsv, toJsonRows, fromJsonRows,
  toMarkdownTable, parseMarkdownTable, toInsertSql,
} from "../csvTool.js";

describe("detectDelimiter", () => {
  it("쉼표·탭·세미콜론을 구분한다", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
  });
});

describe("parseCsv", () => {
  it("헤더와 행을 나눈다", () => {
    const r = parseCsv("이름,나이\n홍길동,30\n김철수,25");
    expect(r.header).toEqual(["이름", "나이"]);
    expect(r.rows).toEqual([["홍길동", "30"], ["김철수", "25"]]);
    expect(r.rowCount).toBe(2);
  });

  it("따옴표 안의 쉼표를 보존한다", () => {
    const r = parseCsv('name,memo\n홍길동,"서울, 강남"');
    expect(r.rows[0][1]).toBe("서울, 강남");
  });

  it("따옴표 안의 개행도 처리한다", () => {
    const r = parseCsv('a,b\n1,"두\n줄"');
    expect(r.rows[0][1]).toBe("두\n줄");
  });

  it("이스케이프된 따옴표(\"\")를 복원한다", () => {
    const r = parseCsv('a\n"그는 ""안녕"" 이라 했다"');
    expect(r.rows[0][0]).toBe('그는 "안녕" 이라 했다');
  });

  it("BOM 과 CRLF 를 처리한다", () => {
    const r = parseCsv("﻿a,b\r\n1,2");
    expect(r.header).toEqual(["a", "b"]);
  });

  it("헤더 없음 옵션", () => {
    const r = parseCsv("1,2\n3,4", { hasHeader: false });
    expect(r.header).toEqual(["col1", "col2"]);
    expect(r.rows).toHaveLength(2);
  });

  it("빈 입력은 실패", () => {
    expect(parseCsv("").ok).toBe(false);
  });
});

describe("toCsv", () => {
  it("특수문자가 있으면 따옴표로 감싼다", () => {
    const out = toCsv({ header: ["a"], rows: [["쉼표,포함"]] });
    expect(out).toBe('a\n"쉼표,포함"');
  });
  it("라운드트립", () => {
    const src = "이름,메모\n홍길동,\"서울, 강남\"";
    const parsed = parseCsv(src);
    expect(parseCsv(toCsv(parsed)).rows).toEqual(parsed.rows);
  });
});

describe("toJsonRows / fromJsonRows", () => {
  it("타입을 추론한다", () => {
    const t = parseCsv("name,age,active\n홍길동,30,true");
    const json = toJsonRows(t);
    expect(json[0]).toEqual({ name: "홍길동", age: 30, active: true });
  });

  it("앞자리 0이 있는 값은 문자열로 둔다(사번·우편번호)", () => {
    const t = parseCsv("code\n007");
    expect(toJsonRows(t)[0].code).toBe("007");
  });

  it("타입 추론 끄기", () => {
    const t = parseCsv("age\n30");
    expect(toJsonRows(t, { typed: false })[0].age).toBe("30");
  });

  it("JSON 배열 → 표 (키 합집합)", () => {
    const r = fromJsonRows('[{"a":1},{"b":2}]');
    expect(r.header).toEqual(["a", "b"]);
    expect(r.rows).toEqual([["1", ""], ["", "2"]]);
  });

  it("배열이 아니면 실패", () => {
    expect(fromJsonRows('{"a":1}').ok).toBe(false);
  });

  it("깨진 JSON 은 사유를 준다", () => {
    expect(fromJsonRows("{").ok).toBe(false);
  });
});

describe("마크다운 표", () => {
  const table = { header: ["이름", "나이"], rows: [["홍길동", "30"]] };

  it("표를 만든다", () => {
    const md = toMarkdownTable(table);
    expect(md.split("\n")).toHaveLength(3);
    expect(md.startsWith("| 이름")).toBe(true);
  });

  it("한글 폭을 고려해 정렬한다", () => {
    const md = toMarkdownTable({ header: ["a"], rows: [["한글"]] });
    // 헤더 셀이 데이터 폭(4)에 맞춰 늘어난다
    expect(md.split("\n")[0]).toBe("| a    |");
  });

  it("파싱해서 되돌린다", () => {
    const md = toMarkdownTable(table);
    const back = parseMarkdownTable(md);
    expect(back.header).toEqual(["이름", "나이"]);
    expect(back.rows).toEqual([["홍길동", "30"]]);
  });

  it("표가 아니면 실패", () => {
    expect(parseMarkdownTable("그냥 문장").ok).toBe(false);
  });
});

// ── SQL INSERT 출력 ────────────────────────────────────────
// 표의 셀을 전부 문자열로 만들면 타입이 사라져 'NULL' 이 빈 문자열이 되고
// 숫자에 따옴표가 붙는다. 그래서 fromJsonRows 는 원본 값(raw)도 함께 넘긴다.
describe("fromJsonRows — 원본 값 보존", () => {
  it("표시용 문자열과 원본 값을 함께 넘긴다", () => {
    const r = fromJsonRows('[{"n":null,"i":30,"b":true,"s":"x"}]');
    expect(r.ok).toBe(true);
    expect(r.rows[0]).toEqual(["", "30", "true", "x"]);
    expect(r.raw[0]).toEqual([null, 30, true, "x"]);
  });

  it("중첩 값은 원본 그대로 남는다", () => {
    const r = fromJsonRows('[{"k":[{"c":1}]}]');
    expect(r.raw[0][0]).toEqual([{ c: 1 }]);
  });
});

describe("toInsertSql — 타입", () => {
  const table = (header, raw) => ({
    header,
    rows: raw.map((r) => r.map((v) => (v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)))),
    raw,
  });

  it("NULL 은 빈 문자열이 아니라 NULL 이다", () => {
    const sql = toInsertSql(table(["n"], [[null]]), "t");
    expect(sql).toContain("VALUES (NULL)");
    expect(sql).not.toContain("''");
  });

  it("숫자와 불리언에는 따옴표를 붙이지 않는다", () => {
    const sql = toInsertSql(table(["i", "f", "b"], [[30, 1.5, true]]), "t", { dialect: "postgres" });
    expect(sql).toContain("VALUES (30, 1.5, TRUE)");
  });

  it("불리언 표기는 방언을 따른다", () => {
    expect(toInsertSql(table(["b"], [[true]]), "t", { dialect: "mysql" })).toContain("(1)");
    expect(toInsertSql(table(["b"], [[false]]), "t", { dialect: "postgres" })).toContain("(FALSE)");
  });

  it("중첩 객체·배열은 JSON 문자열로 넣는다 (JSON 컬럼에 그대로 들어간다)", () => {
    const sql = toInsertSql(table(["k"], [[[{ c1: "d2" }]]]), "t");
    expect(sql).toContain(`'[{"c1":"d2"}]'`);
  });

  it("중첩 값 안의 홑따옴표도 이스케이프한다", () => {
    const sql = toInsertSql(table(["k"], [[{ q: "a'b" }]]), "t");
    expect(sql).toContain(`'{"q":"a''b"}'`);
  });
});

describe("toInsertSql — 식별자", () => {
  const t = (header) => ({ header, rows: [header.map(() => "x")] });

  it("컬럼명과 테이블명을 방언 규칙대로 감싼다", () => {
    expect(toInsertSql(t(["a"]), "users", { dialect: "mysql" })).toContain("INSERT INTO `users` (`a`)");
    expect(toInsertSql(t(["a"]), "users", { dialect: "postgres" })).toContain('INSERT INTO "users" ("a")');
    expect(toInsertSql(t(["a"]), "users", { dialect: "mssql" })).toContain("INSERT INTO [users] ([a])");
  });

  it("예약어 컬럼도 감싸서 깨지지 않는다", () => {
    expect(toInsertSql(t(["order"]), "t", { dialect: "mysql" })).toContain("`order`");
  });

  it("대소문자를 보존한다 (PostgreSQL 에서 KK 가 kk 로 접히지 않는다)", () => {
    expect(toInsertSql(t(["KK"]), "t", { dialect: "postgres" })).toContain('"KK"');
  });

  it("공백이 든 컬럼명을 조용히 바꾸지 않는다", () => {
    const sql = toInsertSql(t(["my col"]), "t", { dialect: "mysql" });
    expect(sql).toContain("`my col`");
    expect(sql).not.toContain("my_col");
  });

  it("식별자 안의 인용부호를 이스케이프한다", () => {
    expect(toInsertSql(t(['a"b']), "t", { dialect: "postgres" })).toContain('"a""b"');
  });
});

describe("toInsertSql — CSV 처럼 타입이 없는 표", () => {
  it("작은따옴표를 이스케이프한다", () => {
    const sql = toInsertSql({ header: ["name"], rows: [["O'Reilly"]] }, "users");
    expect(sql).toBe("INSERT INTO `users` (`name`) VALUES ('O''Reilly');");
  });

  it("숫자·불리언처럼 보이는 칸은 그 타입으로 본다", () => {
    const sql = toInsertSql({ header: ["i", "b"], rows: [["30", "true"]] }, "t", { dialect: "postgres" });
    expect(sql).toContain("VALUES (30, TRUE)");
  });

  it("빈 칸은 NULL 로 본다 (CSV 는 빈칸과 NULL 을 구분하지 못한다)", () => {
    expect(toInsertSql({ header: ["a"], rows: [[""]] }, "t")).toContain("(NULL)");
  });

  it("앞자리 0 이 있는 값은 문자열로 둔다 (사번·우편번호)", () => {
    expect(toInsertSql({ header: ["z"], rows: [["01234"]] }, "t")).toContain("'01234'");
  });
});
