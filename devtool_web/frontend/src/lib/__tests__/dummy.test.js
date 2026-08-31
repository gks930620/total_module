// DB 더미데이터 생성기 계약 테스트 — 구현 전 선작성(Red).
//
// 이 도구는 "테스트 데이터 일반"이 아니라 **DB 더미데이터(data.sql) 전용**이다.
// 그래서 주(主)가 되는 건 생성기가 아니라 **DB 컬럼의 데이터타입**이다.
//   필드 = { name(컬럼명), type(DB 데이터타입), params(길이·정밀도), note(비고), nullPercent }
import { describe, it, expect } from "vitest";
import {
  SQL_DIALECTS, DB_TYPES, MAX_ROWS,
  getDbType, renderType, createField, generateRows, buildRandom,
  toCsv, toJson, toInsertSql, toCreateTable,
  sortRows,
} from "../dummy.js";

const f = (dialect, type, name, params, extra) => {
  const base = createField(dialect, type, name);
  return { ...base, params: { ...base.params, ...params }, ...extra };
};

describe("DB 방언과 데이터타입 목록", () => {
  it("방언 5종을 제공한다", () => {
    expect(SQL_DIALECTS.map((d) => d.key)).toEqual(
      expect.arrayContaining(["mysql", "postgres", "oracle", "mssql", "sqlite"])
    );
  });

  it("방언마다 자기 데이터타입 목록을 갖는다", () => {
    for (const d of SQL_DIALECTS) {
      expect(DB_TYPES[d.key], `${d.key} 타입 목록`).toBeTruthy();
      expect(DB_TYPES[d.key].length).toBeGreaterThan(5);
    }
  });

  it("데이터타입 이름은 영어 대문자다 — DB 타입이니까", () => {
    for (const d of SQL_DIALECTS) {
      for (const t of DB_TYPES[d.key]) {
        expect(t.key, `${d.key}.${t.key}`).toMatch(/^[A-Z0-9 _()]+$/);
      }
    }
  });

  it("DB 마다 실제로 있는 타입만 넣는다", () => {
    const key = (dialect) => DB_TYPES[dialect].map((t) => t.key);
    expect(key("mysql")).toContain("DATETIME");
    expect(key("mysql")).toContain("TINYINT");
    expect(key("postgres")).toContain("JSONB");
    expect(key("postgres")).toContain("TIMESTAMP");
    expect(key("postgres")).not.toContain("DATETIME"); // PG 에는 DATETIME 이 없다
    expect(key("oracle")).toContain("VARCHAR2");
    expect(key("oracle")).toContain("NUMBER");
    expect(key("oracle")).not.toContain("VARCHAR"); // Oracle 은 VARCHAR2 를 쓴다
    expect(key("mssql")).toContain("NVARCHAR");
    expect(key("mssql")).toContain("BIT");
    expect(key("sqlite")).toContain("INTEGER");
  });

  it("모든 타입이 값 생성 방식(kind)을 갖는다", () => {
    const kinds = ["string", "int", "decimal", "bool", "date", "datetime", "time", "json", "uuid"];
    for (const d of SQL_DIALECTS) {
      for (const t of DB_TYPES[d.key]) {
        expect(kinds, `${d.key}.${t.key}.kind=${t.kind}`).toContain(t.kind);
      }
    }
  });

  it("getDbType 은 모르는 타입에 null 을 준다", () => {
    expect(getDbType("mysql", "VARCHAR")?.key).toBe("VARCHAR");
    expect(getDbType("mysql", "없는타입")).toBeNull();
  });
});

describe("renderType — DDL 에 쓸 타입 표기", () => {
  it("길이·정밀도 파라미터를 괄호로 붙인다", () => {
    expect(renderType("mysql", f("mysql", "VARCHAR", "c", { length: 20 }))).toBe("VARCHAR(20)");
    expect(renderType("mysql", f("mysql", "DECIMAL", "c", { precision: 10, scale: 3 }))).toBe("DECIMAL(10,3)");
    expect(renderType("oracle", f("oracle", "VARCHAR2", "c", { length: 100 }))).toBe("VARCHAR2(100)");
  });

  it("파라미터가 없는 타입은 이름만 쓴다", () => {
    expect(renderType("mysql", createField("mysql", "DATETIME", "c"))).toBe("DATETIME");
    expect(renderType("postgres", createField("postgres", "JSONB", "c"))).toBe("JSONB");
  });
});

describe("createField", () => {
  it("컬럼명·타입·파라미터 기본값·비고를 갖춘 필드를 만든다", () => {
    const field = createField("mysql", "VARCHAR", "user_name");
    expect(field.name).toBe("user_name");
    expect(field.type).toBe("VARCHAR");
    expect(field.params.length).toBeGreaterThan(0);
    expect(field.note).toBe("");
    expect(field.nullPercent).toBe(0);
  });

  it("모르는 타입이면 그 방언의 첫 타입으로 만든다", () => {
    expect(createField("mysql", "없는타입", "c").type).toBe(DB_TYPES.mysql[0].key);
  });
});

describe("generateRows — 데이터타입이 값을 결정한다", () => {
  it("컬럼명 그대로 키를 만든다", () => {
    const fields = [createField("mysql", "VARCHAR", "user_name"), createField("mysql", "INT", "age")];
    const rows = generateRows(fields, 5, { dialect: "mysql" });
    expect(rows).toHaveLength(5);
    expect(Object.keys(rows[0])).toEqual(["user_name", "age"]);
  });

  it("정수 타입은 number 를, 문자 타입은 string 을 만든다", () => {
    const fields = [createField("mysql", "INT", "n"), createField("mysql", "VARCHAR", "s")];
    const [row] = generateRows(fields, 1, { dialect: "mysql" });
    expect(typeof row.n).toBe("number");
    expect(Number.isInteger(row.n)).toBe(true);
    expect(typeof row.s).toBe("string");
  });

  it("TINYINT 는 타입 범위를 넘지 않는다", () => {
    const rows = generateRows([createField("mysql", "TINYINT", "n")], 60, { dialect: "mysql" });
    for (const r of rows) {
      expect(r.n).toBeGreaterThanOrEqual(-128);
      expect(r.n).toBeLessThanOrEqual(127);
    }
  });

  it("SQL Server TINYINT 는 0~255 다 (MySQL 과 범위가 다르다)", () => {
    const rows = generateRows([createField("mssql", "TINYINT", "n")], 60, { dialect: "mssql" });
    for (const r of rows) {
      expect(r.n).toBeGreaterThanOrEqual(0);
      expect(r.n).toBeLessThanOrEqual(255);
    }
  });

  it("사용자가 준 min/max 를 지킨다", () => {
    const rows = generateRows([f("mysql", "INT", "n", { min: 10, max: 12 })], 40, { dialect: "mysql" });
    for (const r of rows) {
      expect(r.n).toBeGreaterThanOrEqual(10);
      expect(r.n).toBeLessThanOrEqual(12);
    }
  });

  it("DECIMAL 은 지정한 소수 자릿수를 지킨다", () => {
    const rows = generateRows([f("mysql", "DECIMAL", "d", { precision: 8, scale: 2 })], 30, { dialect: "mysql" });
    for (const r of rows) {
      const dec = String(r.d).split(".")[1] || "";
      expect(dec.length).toBeLessThanOrEqual(2);
    }
  });

  it("BOOLEAN/BIT 는 boolean 을 만든다", () => {
    expect(typeof generateRows([createField("mysql", "BOOLEAN", "b")], 1, { dialect: "mysql" })[0].b).toBe("boolean");
    expect(typeof generateRows([createField("mssql", "BIT", "b")], 1, { dialect: "mssql" })[0].b).toBe("boolean");
  });

  it("DATE / DATETIME / TIME 형식을 지킨다", () => {
    const [row] = generateRows([
      createField("mysql", "DATE", "d"),
      createField("mysql", "DATETIME", "dt"),
      createField("mysql", "TIME", "t"),
    ], 1, { dialect: "mysql" });
    expect(row.d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.dt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(row.t).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("UUID 타입은 UUID 형식이다", () => {
    const [row] = generateRows([createField("postgres", "UUID", "id")], 1, { dialect: "postgres" });
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("JSON 타입은 파싱되는 JSON 문자열이다", () => {
    const [row] = generateRows([createField("mysql", "JSON", "j")], 1, { dialect: "mysql" });
    expect(() => JSON.parse(row.j)).not.toThrow();
  });

  it("이름 없는 필드는 건너뛴다", () => {
    const rows = generateRows([createField("mysql", "INT", ""), createField("mysql", "INT", "n")], 1, { dialect: "mysql" });
    expect(Object.keys(rows[0])).toEqual(["n"]);
  });

  it("행 수 상한은 500 이다", () => {
    expect(MAX_ROWS).toBe(500);
    expect(generateRows([createField("mysql", "INT", "n")], 99999, { dialect: "mysql" })).toHaveLength(500);
    expect(generateRows([createField("mysql", "INT", "n")], 121, { dialect: "mysql" })).toHaveLength(121);
  });

  it("nullPercent 100 이면 전부 null 이다", () => {
    const rows = generateRows([{ ...createField("mysql", "VARCHAR", "s"), nullPercent: 100 }], 10, { dialect: "mysql" });
    expect(rows.every((r) => r.s === null)).toBe(true);
  });

  it("비고(note)는 값에 영향을 주지 않는다", () => {
    const a = generateRows([{ ...createField("mysql", "INT", "n"), note: "" }], 5, { dialect: "mysql", seed: "s" });
    const b = generateRows([{ ...createField("mysql", "INT", "n"), note: "회원 나이" }], 5, { dialect: "mysql", seed: "s" });
    expect(a).toEqual(b);
  });
});

describe("문자열 길이 — 선언한 길이를 넘지 않는다", () => {
  it("VARCHAR(n) 은 n 글자를 넘지 않는다", () => {
    const rows = generateRows([f("mysql", "VARCHAR", "s", { length: 8 })], 60, { dialect: "mysql" });
    for (const r of rows) expect(r.s.length).toBeLessThanOrEqual(8);
  });

  it("255 를 꽉 채우지 않는다 — 더미데이터는 짧아야 읽힌다", () => {
    const rows = generateRows([f("mysql", "VARCHAR", "s", { length: 255 })], 40, { dialect: "mysql" });
    for (const r of rows) expect(r.s.length).toBeLessThanOrEqual(40);
  });

  it("Oracle VARCHAR2(n) 은 n **바이트**를 넘지 않는다 (한글은 3바이트)", () => {
    const enc = new TextEncoder();
    const rows = generateRows([f("oracle", "VARCHAR2", "s", { length: 10, charset: "korean" })], 60, { dialect: "oracle" });
    for (const r of rows) {
      expect(enc.encode(r.s).length, `"${r.s}" 가 10바이트 초과`).toBeLessThanOrEqual(10);
    }
  });

  it("MySQL VARCHAR(n) 은 n **글자** 기준이라 한글도 n 자까지 들어간다", () => {
    const rows = generateRows([f("mysql", "VARCHAR", "s", { length: 10, charset: "korean", minLength: 10 })], 20, { dialect: "mysql" });
    for (const r of rows) expect(r.s.length).toBe(10);
  });

  it("CHAR(n) 은 길이가 정확히 n 이다", () => {
    const rows = generateRows([f("mysql", "CHAR", "s", { length: 6 })], 20, { dialect: "mysql" });
    for (const r of rows) expect(r.s.length).toBe(6);
  });

  it("문자 종류를 고를 수 있다", () => {
    const kr = generateRows([f("mysql", "VARCHAR", "s", { length: 20, charset: "korean" })], 20, { dialect: "mysql" });
    for (const r of kr) expect(r.s).toMatch(/^[가-힣]+$/);

    const en = generateRows([f("mysql", "VARCHAR", "s", { length: 20, charset: "alpha" })], 20, { dialect: "mysql" });
    for (const r of en) expect(r.s).toMatch(/^[a-zA-Z]+$/);

    const dg = generateRows([f("mysql", "VARCHAR", "s", { length: 20, charset: "digit" })], 20, { dialect: "mysql" });
    for (const r of dg) expect(r.s).toMatch(/^[0-9]+$/);
  });
});

describe("시드 — 같은 결과 재현", () => {
  it("같은 시드면 같은 데이터가 나온다", () => {
    const fields = [createField("mysql", "VARCHAR", "s"), createField("mysql", "INT", "n"), createField("mysql", "DATE", "d")];
    const a = generateRows(fields, 20, { dialect: "mysql", seed: "abc" });
    const b = generateRows(fields, 20, { dialect: "mysql", seed: "abc" });
    expect(a).toEqual(b);
  });

  it("시드가 다르면 다르다 / 없으면 매번 다르다", () => {
    const fields = [createField("mysql", "VARCHAR", "s")];
    expect(generateRows(fields, 30, { dialect: "mysql", seed: "one" }))
      .not.toEqual(generateRows(fields, 30, { dialect: "mysql", seed: "two" }));
    expect(generateRows(fields, 30, { dialect: "mysql" }))
      .not.toEqual(generateRows(fields, 30, { dialect: "mysql" }));
  });

  it("buildRandom 은 시드가 같으면 같은 수열을 준다", () => {
    const a = buildRandom("x"), b = buildRandom("x");
    expect(Array.from({ length: 5 }, () => a(100))).toEqual(Array.from({ length: 5 }, () => b(100)));
  });
});

describe("toInsertSql", () => {
  const fields = [createField("mysql", "INT", "id"), createField("mysql", "VARCHAR", "name")];

  it("숫자는 따옴표 없이, 문자열은 따옴표로 감싼다", () => {
    const sql = toInsertSql(fields, [{ id: 7, name: "가나" }], { table: "t", dialect: "mysql" });
    expect(sql).toContain("(7, '가나')");
  });

  it("작은따옴표를 이스케이프한다", () => {
    const sql = toInsertSql(fields, [{ id: 1, name: "O'Brien" }], { table: "t", dialect: "mysql" });
    expect(sql).toContain("'O''Brien'");
  });

  it("null 은 NULL 이다", () => {
    const sql = toInsertSql(fields, [{ id: 1, name: null }], { table: "t", dialect: "mysql" });
    expect(sql).toContain("NULL");
    expect(sql).not.toContain("'NULL'");
  });

  it("방언별 식별자 따옴표", () => {
    const rows = [{ id: 1, name: "a" }];
    expect(toInsertSql(fields, rows, { table: "users", dialect: "mysql" })).toContain("`users` (`id`, `name`)");
    expect(toInsertSql(fields, rows, { table: "users", dialect: "postgres" })).toContain('"users" ("id", "name")');
    expect(toInsertSql(fields, rows, { table: "users", dialect: "mssql" })).toContain("[users] ([id], [name])");
  });

  it("불리언은 방언에 맞게 낸다", () => {
    expect(toInsertSql([createField("postgres", "BOOLEAN", "flag")], [{ flag: true }], { table: "t", dialect: "postgres" })).toContain("(TRUE)");
    expect(toInsertSql([createField("mysql", "BOOLEAN", "flag")], [{ flag: true }], { table: "t", dialect: "mysql" })).toContain("(1)");
  });

  it("Oracle 날짜는 TO_DATE 로 감싼다", () => {
    const sql = toInsertSql([createField("oracle", "DATE", "d")], [{ d: "2024-03-01 10:20:30" }], { table: "t", dialect: "oracle" });
    expect(sql).toContain("TO_DATE(");
  });

  it("batch 는 한 문장, Oracle 은 문법상 행마다", () => {
    const rows = [{ id: 1, name: "a" }, { id: 2, name: "b" }, { id: 3, name: "c" }];
    expect((toInsertSql(fields, rows, { table: "t", batch: true, dialect: "mysql" }).match(/INSERT INTO/g) || []).length).toBe(1);
    expect((toInsertSql(fields, rows, { table: "t", batch: false, dialect: "mysql" }).match(/INSERT INTO/g) || []).length).toBe(3);
    const oracleFields = [createField("oracle", "NUMBER", "id")];
    expect((toInsertSql(oracleFields, [{ id: 1 }, { id: 2 }], { table: "t", batch: true, dialect: "oracle" }).match(/INSERT INTO/g) || []).length).toBe(2);
  });

  it("빈 입력은 빈 문자열", () => {
    expect(toInsertSql([], [], { table: "t", dialect: "mysql" })).toBe("");
  });
});

describe("toCreateTable", () => {
  it("선언한 데이터타입을 그대로 쓴다", () => {
    const fields = [
      f("mysql", "VARCHAR", "name", { length: 30 }),
      createField("mysql", "INT", "age"),
      createField("mysql", "DATETIME", "created_at"),
    ];
    const ddl = toCreateTable(fields, { table: "users", dialect: "mysql" });
    expect(ddl).toContain("CREATE TABLE `users`");
    expect(ddl).toContain("`name` VARCHAR(30)");
    expect(ddl).toContain("`age` INT");
    expect(ddl).toContain("`created_at` DATETIME");
  });

  it("NULL % 가 0 이면 NOT NULL", () => {
    expect(toCreateTable([createField("mysql", "INT", "n")], { table: "t", dialect: "mysql" })).toContain("NOT NULL");
    expect(toCreateTable([{ ...createField("mysql", "INT", "n"), nullPercent: 20 }], { table: "t", dialect: "mysql" })).not.toContain("NOT NULL");
  });

  it("비고를 MySQL 은 COMMENT 로 붙인다", () => {
    const fields = [{ ...createField("mysql", "INT", "age"), note: "회원 나이" }];
    expect(toCreateTable(fields, { table: "t", dialect: "mysql" })).toContain("COMMENT '회원 나이'");
  });

  it("비고를 PostgreSQL 은 COMMENT ON COLUMN 문으로 낸다", () => {
    const fields = [{ ...createField("postgres", "INTEGER", "age"), note: "회원 나이" }];
    const ddl = toCreateTable(fields, { table: "users", dialect: "postgres" });
    expect(ddl).toContain(`COMMENT ON COLUMN "users"."age" IS '회원 나이';`);
  });

  it("비고가 없으면 COMMENT 를 붙이지 않는다", () => {
    expect(toCreateTable([createField("mysql", "INT", "n")], { table: "t", dialect: "mysql" })).not.toContain("COMMENT");
  });

  it("PostgreSQL 식별자는 큰따옴표", () => {
    expect(toCreateTable([createField("postgres", "INTEGER", "n")], { table: "t", dialect: "postgres" })).toContain('CREATE TABLE "t"');
  });
});

describe("toCsv / toJson", () => {
  const fields = [createField("mysql", "INT", "id"), createField("mysql", "VARCHAR", "name")];
  const rows = [{ id: 1, name: '따옴표"와,쉼표' }, { id: 2, name: null }];

  it("헤더는 컬럼명, 특수문자는 감싼다", () => {
    const csv = toCsv(fields, rows);
    expect(csv.split("\n")[0]).toBe("id,name");
    expect(csv).toContain('"따옴표""와,쉼표"');
  });

  it("헤더·줄바꿈·BOM·구분자 옵션", () => {
    expect(toCsv(fields, rows, { header: false }).startsWith("id,name")).toBe(false);
    expect(toCsv(fields, rows, { lineEnding: "crlf" })).toContain("\r\n");
    expect(toCsv(fields, rows, { bom: true }).charCodeAt(0)).toBe(0xfeff);
    expect(toCsv(fields, rows, { delimiter: "\t" }).split("\n")[0]).toBe("id\tname");
  });

  it("JSON 은 숫자·null 을 그대로 낸다", () => {
    const json = JSON.parse(toJson(fields, rows));
    expect(json[0].id).toBe(1);
    expect(json[1].name).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// SQL 가져오기 — 이미 있는 테이블에 넣을 데이터를 만드는 게 실제 흐름이다.
// CREATE TABLE 이나 INSERT 문을 붙여넣으면 컬럼 정의가 만들어진다.
// ─────────────────────────────────────────────────────────────
import { parseSchema } from "../dummy.js";

describe("parseSchema — CREATE TABLE", () => {
  const mysqlDdl = `
CREATE TABLE \`users\` (
  \`id\` BIGINT NOT NULL AUTO_INCREMENT COMMENT '회원 번호',
  \`email\` VARCHAR(255) NOT NULL,
  \`name\` VARCHAR(20) DEFAULT NULL COMMENT '이름',
  \`age\` TINYINT UNSIGNED,
  \`balance\` DECIMAL(12,2) NOT NULL DEFAULT 0,
  \`is_active\` TINYINT(1) NOT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_email\` (\`email\`),
  KEY \`idx_name\` (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

  it("테이블명과 컬럼을 읽는다", () => {
    const r = parseSchema(mysqlDdl);
    expect(r.ok).toBe(true);
    expect(r.table).toBe("users");
    expect(r.fields.map((f) => f.name)).toEqual(
      ["id", "email", "name", "age", "balance", "is_active", "created_at"]
    );
  });

  it("제약조건 줄(PRIMARY KEY·UNIQUE KEY·KEY)은 컬럼으로 세지 않는다", () => {
    const names = parseSchema(mysqlDdl).fields.map((f) => f.name);
    for (const bad of ["PRIMARY", "UNIQUE", "KEY", "uk_email", "idx_name"]) {
      expect(names).not.toContain(bad);
    }
  });

  it("타입과 길이·정밀도를 읽는다", () => {
    const byName = Object.fromEntries(parseSchema(mysqlDdl).fields.map((f) => [f.name, f]));
    expect(byName.email.type).toBe("VARCHAR");
    expect(byName.email.params.length).toBe(255);
    expect(byName.balance.type).toBe("DECIMAL");
    expect(byName.balance.params.precision).toBe(12);
    expect(byName.balance.params.scale).toBe(2);
    expect(byName.created_at.type).toBe("DATETIME");
  });

  it("COMMENT 를 비고로 가져온다", () => {
    const byName = Object.fromEntries(parseSchema(mysqlDdl).fields.map((f) => [f.name, f]));
    expect(byName.id.note).toBe("회원 번호");
    expect(byName.name.note).toBe("이름");
    expect(byName.email.note).toBe("");
  });

  it("NOT NULL 이면 NULL % 0, 아니면 0 보다 크게 잡는다", () => {
    const byName = Object.fromEntries(parseSchema(mysqlDdl).fields.map((f) => [f.name, f]));
    expect(byName.email.nullPercent).toBe(0);
    expect(byName.name.nullPercent).toBeGreaterThan(0); // DEFAULT NULL
    expect(byName.age.nullPercent).toBeGreaterThan(0);  // NOT NULL 없음
  });

  it("TINYINT(1) 은 MySQL 관례상 불리언이다", () => {
    const byName = Object.fromEntries(parseSchema(mysqlDdl).fields.map((f) => [f.name, f]));
    expect(byName.is_active.type).toBe("BOOLEAN");
    // 폭이 1 이 아니면 그냥 정수다
    expect(byName.age.type).toBe("TINYINT");
  });

  it("MySQL 을 알아본다", () => {
    expect(parseSchema(mysqlDdl).dialect).toBe("mysql");
  });

  it("PostgreSQL 을 알아보고 SERIAL 을 정수로 바꾼다", () => {
    const r = parseSchema(`
CREATE TABLE posts (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  views INTEGER DEFAULT 0,
  meta JSONB,
  created_at TIMESTAMP NOT NULL
);
COMMENT ON COLUMN posts.title IS '제목';`);
    expect(r.ok).toBe(true);
    expect(r.dialect).toBe("postgres");
    expect(r.table).toBe("posts");
    const byName = Object.fromEntries(r.fields.map((f) => [f.name, f]));
    expect(byName.id.type).toBe("BIGINT");      // BIGSERIAL → BIGINT
    expect(byName.meta.type).toBe("JSONB");
    expect(byName.created_at.type).toBe("TIMESTAMP");
    expect(byName.title.note).toBe("제목");      // COMMENT ON COLUMN
  });

  it("Oracle 을 알아본다", () => {
    const r = parseSchema(`
CREATE TABLE EMP (
  ID NUMBER(10) NOT NULL,
  ENAME VARCHAR2(20),
  HIRED DATE
);`);
    expect(r.dialect).toBe("oracle");
    const byName = Object.fromEntries(r.fields.map((f) => [f.name, f]));
    expect(byName.ENAME.type).toBe("VARCHAR2");
    expect(byName.ID.type).toBe("NUMBER");
  });

  it("SQL Server 를 알아본다", () => {
    const r = parseSchema(`
CREATE TABLE [dbo].[Members] (
  [Id] INT NOT NULL,
  [Name] NVARCHAR(50) NOT NULL,
  [IsActive] BIT NOT NULL,
  [JoinedAt] DATETIME2 NOT NULL
);`);
    expect(r.dialect).toBe("mssql");
    expect(r.table).toBe("Members");
    expect(r.fields.map((f) => f.name)).toEqual(["Id", "Name", "IsActive", "JoinedAt"]);
  });

  it("지정한 방언이 있으면 그쪽 타입으로 옮긴다", () => {
    const r = parseSchema("CREATE TABLE t (a INT NOT NULL, b DATETIME NOT NULL);", "postgres");
    expect(r.dialect).toBe("postgres");
    const byName = Object.fromEntries(r.fields.map((f) => [f.name, f]));
    expect(byName.a.type).toBe("INTEGER");   // PG 에는 INT 대신 INTEGER
    expect(byName.b.type).toBe("TIMESTAMP"); // PG 에는 DATETIME 이 없다
  });

  it("모르는 타입은 경고를 남기고 기본 타입으로 넣는다", () => {
    const r = parseSchema("CREATE TABLE t (a GEOMETRY NOT NULL);", "mysql");
    expect(r.ok).toBe(true);
    expect(r.fields).toHaveLength(1);
    expect(r.warnings.join(" ")).toContain("GEOMETRY");
  });
});

describe("parseSchema — INSERT 문", () => {
  it("컬럼명을 읽고 값에서 타입을 추론한다", () => {
    const r = parseSchema(
      `INSERT INTO orders (id, product, price, ordered_at, is_paid)
       VALUES (1, '무선 이어폰', 39900, '2024-05-01 10:20:30', 1);`
    );
    expect(r.ok).toBe(true);
    expect(r.table).toBe("orders");
    const byName = Object.fromEntries(r.fields.map((f) => [f.name, f]));
    expect(byName.id.type).toBe("INT");
    expect(byName.price.type).toBe("INT");
    expect(byName.product.type).toBe("VARCHAR");
    expect(byName.ordered_at.type).toBe("DATETIME");
  });

  it("날짜만 있는 값은 DATE 로 본다", () => {
    const r = parseSchema(`INSERT INTO t (d) VALUES ('2024-05-01');`);
    expect(r.fields[0].type).toBe("DATE");
  });

  it("소수는 DECIMAL 로 본다", () => {
    const r = parseSchema(`INSERT INTO t (rate) VALUES (12.75);`);
    expect(r.fields[0].type).toBe("DECIMAL");
  });

  it("문자열 길이에 맞춰 VARCHAR 길이를 넉넉히 잡는다", () => {
    const r = parseSchema(`INSERT INTO t (memo) VALUES ('가나다라마바사');`);
    expect(r.fields[0].params.length).toBeGreaterThanOrEqual(7);
  });
});

describe("parseSchema — 실패 처리", () => {
  it("빈 입력은 ok:false", () => {
    expect(parseSchema("").ok).toBe(false);
    expect(parseSchema("   ").ok).toBe(false);
  });

  it("CREATE TABLE 도 INSERT 도 아니면 ok:false 와 이유", () => {
    const r = parseSchema("SELECT * FROM users;");
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("컬럼을 하나도 못 찾으면 ok:false", () => {
    expect(parseSchema("CREATE TABLE t ();").ok).toBe(false);
  });

  it("터지지 않는다", () => {
    for (const bad of ["CREATE TABLE", "CREATE TABLE t (", "INSERT INTO", "((((", "'''"]) {
      expect(() => parseSchema(bad)).not.toThrow();
    }
  });
});

describe("선언한 타입의 제약을 값이 지킨다", () => {
  it("DECIMAL(p,s) 의 전체 자릿수를 넘지 않는다 — 넘으면 INSERT 가 실패한다", () => {
    // DECIMAL(4,2) 는 정수부 2자리 + 소수 2자리 = 최대 99.99
    const rows = generateRows([f("mysql", "DECIMAL", "d", { precision: 4, scale: 2 })], 60, { dialect: "mysql" });
    for (const r of rows) {
      expect(Math.abs(r.d), `${r.d} 가 99.99 초과`).toBeLessThan(100);
    }
  });

  it("자릿수가 작아도 소수 자릿수는 지킨다", () => {
    const rows = generateRows([f("mysql", "DECIMAL", "d", { precision: 3, scale: 1 })], 40, { dialect: "mysql" });
    for (const r of rows) {
      expect(Math.abs(r.d)).toBeLessThan(100);
      expect((String(r.d).split(".")[1] || "").length).toBeLessThanOrEqual(1);
    }
  });

  it("소수 자릿수가 전체 자릿수보다 클 수 없다", () => {
    const field = f("mysql", "DECIMAL", "d", { precision: 3, scale: 9 });
    expect(renderType("mysql", field)).toBe("DECIMAL(3,3)");
    expect(() => generateRows([field], 10, { dialect: "mysql" })).not.toThrow();
  });

  it("Oracle NUMBER 도 같은 규칙을 지킨다", () => {
    const rows = generateRows([f("oracle", "NUMBER", "n", { precision: 6, scale: 3 })], 40, { dialect: "oracle" });
    for (const r of rows) expect(Math.abs(r.n)).toBeLessThan(1000);
  });

  it("사용자 min/max 가 타입 범위 밖이면 타입 범위로 자른다", () => {
    const rows = generateRows([f("mysql", "TINYINT", "n", { min: 0, max: 9999 })], 60, { dialect: "mysql" });
    for (const r of rows) expect(r.n).toBeLessThanOrEqual(127);
  });
});

describe("문자열은 절대 비지 않는다", () => {
  it("한글이 1자도 안 들어가는 바이트 길이면 1바이트 문자로 채운다", () => {
    // Oracle VARCHAR2(2) 는 2바이트 — 한글(3바이트)이 한 자도 못 들어간다
    const rows = generateRows([f("oracle", "VARCHAR2", "s", { length: 2, charset: "korean" })], 30, { dialect: "oracle" });
    const enc = new TextEncoder();
    for (const r of rows) {
      expect(r.s.length, "빈 문자열이 나오면 안 된다").toBeGreaterThan(0);
      expect(enc.encode(r.s).length).toBeLessThanOrEqual(2);
    }
  });

  it("길이 1 이어도 값이 나온다", () => {
    for (const [d, t] of [["mysql", "VARCHAR"], ["mysql", "CHAR"], ["oracle", "VARCHAR2"]]) {
      const rows = generateRows([f(d, t, "s", { length: 1 })], 10, { dialect: d });
      for (const r of rows) expect(r.s.length, `${d}.${t}(1)`).toBe(1);
    }
  });
});

describe("SQLite 타입 목록", () => {
  it("BLOB 은 제공하지 않는다 — 바이너리를 텍스트로 만들 수는 없다", () => {
    expect(DB_TYPES.sqlite.map((t) => t.key)).not.toContain("BLOB");
  });
});

describe("sortRows — ORDER BY", () => {
  const fields = [
    createField("mysql", "INT", "id"),
    createField("mysql", "VARCHAR", "name"),
    createField("mysql", "DATE", "d"),
  ];

  it("정렬 기준이 없으면 원래 순서 그대로다", () => {
    const rows = [{ id: 3 }, { id: 1 }, { id: 2 }];
    expect(sortRows(fields, rows, {}).map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortRows(fields, rows, { by: "" }).map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it("숫자는 숫자 크기로 정렬한다(문자열 정렬이 아니다)", () => {
    const rows = [{ id: 10 }, { id: 9 }, { id: 100 }];
    expect(sortRows(fields, rows, { by: "id", dir: "asc" }).map((r) => r.id)).toEqual([9, 10, 100]);
    expect(sortRows(fields, rows, { by: "id", dir: "desc" }).map((r) => r.id)).toEqual([100, 10, 9]);
  });

  it("한글 문자열은 가나다 순으로 정렬한다", () => {
    const rows = [{ name: "하늘" }, { name: "가람" }, { name: "나무" }];
    expect(sortRows(fields, rows, { by: "name", dir: "asc" }).map((r) => r.name))
      .toEqual(["가람", "나무", "하늘"]);
  });

  it("날짜(ISO 문자열)도 시간 순이 된다", () => {
    const rows = [{ d: "2024-12-01" }, { d: "2024-01-15" }, { d: "2024-06-30" }];
    expect(sortRows(fields, rows, { by: "d", dir: "asc" }).map((r) => r.d))
      .toEqual(["2024-01-15", "2024-06-30", "2024-12-01"]);
  });

  it("NULL 은 방향과 관계없이 뒤로 보낸다", () => {
    const rows = [{ id: 2 }, { id: null }, { id: 1 }];
    expect(sortRows(fields, rows, { by: "id", dir: "asc" }).map((r) => r.id)).toEqual([1, 2, null]);
    expect(sortRows(fields, rows, { by: "id", dir: "desc" }).map((r) => r.id)).toEqual([2, 1, null]);
  });

  it("불리언은 false 가 앞이다", () => {
    const bf = [createField("mysql", "BOOLEAN", "b")];
    const rows = [{ b: true }, { b: false }, { b: true }];
    expect(sortRows(bf, rows, { by: "b", dir: "asc" }).map((r) => r.b)).toEqual([false, true, true]);
  });

  it("없는 컬럼으로 정렬하면 원래 순서를 유지한다", () => {
    const rows = [{ id: 3 }, { id: 1 }];
    expect(sortRows(fields, rows, { by: "없는컬럼" }).map((r) => r.id)).toEqual([3, 1]);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const rows = [{ id: 3 }, { id: 1 }];
    sortRows(fields, rows, { by: "id" });
    expect(rows.map((r) => r.id)).toEqual([3, 1]);
  });
});

// ── 스키마 가져오기: SQL 이 아닌 소스 ───────────────────────────────
// 실무 흐름은 "이미 있는 테이블에 넣을 데이터"다. 그 테이블의 모양은 DDL 로만 오지 않는다 —
// JPA 를 쓰면 엔티티 클래스가 곧 스키마이고, 데이터를 CSV·JSON 으로 받는 경우도 있다.
describe("스키마 가져오기 — JPA 자바 엔티티", () => {
  const ENTITY = `
    package com.example.domain;

    import jakarta.persistence.*;

    @Entity
    @Table(name = "member")
    public class MemberEntity {
        private static final long serialVersionUID = 1L;

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(name = "login_id", length = 30, nullable = false)
        private String loginId;

        @Column(length = 60)
        private String nickName;

        @Column(precision = 12, scale = 2)
        private BigDecimal point;

        private Integer age;
        private Boolean active;
        private LocalDate birthDay;
        private LocalDateTime createdAt;

        @Enumerated(EnumType.STRING)
        private MemberStatus status;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "team_id")
        private Team team;

        @OneToMany(mappedBy = "member")
        private List<Order> orders = new ArrayList<>();

        @Transient
        private String tempToken;

        public String getLoginId() {
            String prefix = "x";
            return prefix + loginId;
        }
    }
  `;

  const parsed = parseSchema(ENTITY, "mysql");
  const by = (name) => parsed.fields.find((f) => f.name === name);

  it("자바 클래스를 알아본다", () => {
    expect(parsed.ok).toBe(true);
    expect(parsed.source).toBe("java");
  });

  it("@Table(name) 을 테이블명으로 쓴다", () => {
    expect(parsed.table).toBe("member");
  });

  it("camelCase 필드는 JPA 기본 규칙대로 snake_case 컬럼이 된다", () => {
    expect(by("nick_name")).toBeTruthy();
    expect(by("birth_day")).toBeTruthy();
    expect(by("created_at")).toBeTruthy();
  });

  it("@Column(name) 이 있으면 그 이름을 쓴다", () => {
    expect(by("login_id")).toBeTruthy();
    expect(by("loginId")).toBeFalsy();
  });

  it("자바 타입을 DB 타입으로 옮긴다", () => {
    expect(by("id").type).toBe("BIGINT");
    expect(by("login_id").type).toBe("VARCHAR");
    expect(by("point").type).toBe("DECIMAL");
    expect(by("age").type).toBe("INT");
    expect(by("active").type).toBe("BOOLEAN");
    expect(by("birth_day").type).toBe("DATE");
    expect(by("created_at").type).toBe("DATETIME");
  });

  it("@Column 의 length·precision·scale 을 가져온다", () => {
    expect(by("login_id").params.length).toBe(30);
    expect(by("nick_name").params.length).toBe(60);
    expect(by("point").params.precision).toBe(12);
    expect(by("point").params.scale).toBe(2);
  });

  it("nullable=false 와 @Id 는 NOT NULL 로 본다", () => {
    expect(by("login_id").nullPercent).toBe(0);
    expect(by("id").nullPercent).toBe(0);
    expect(by("nick_name").nullPercent).toBeGreaterThan(0);
  });

  it("enum 은 문자열 컬럼이 된다", () => {
    expect(by("status").type).toBe("VARCHAR");
  });

  it("@ManyToOne 은 @JoinColumn 이름의 FK 컬럼이 된다", () => {
    expect(by("team_id")).toBeTruthy();
    expect(by("team_id").type).toBe("BIGINT");
    expect(by("team")).toBeFalsy();
  });

  it("@OneToMany 컬렉션은 컬럼이 아니다", () => {
    expect(by("orders")).toBeFalsy();
  });

  it("@Transient·static 필드는 제외한다", () => {
    expect(by("temp_token")).toBeFalsy();
    expect(by("serial_version_uid")).toBeFalsy();
  });

  it("메서드 본문의 지역변수를 컬럼으로 착각하지 않는다", () => {
    expect(by("prefix")).toBeFalsy();
  });

  it("@Table 이 없으면 클래스명을 snake_case 테이블명으로 쓴다", () => {
    const r = parseSchema("@Entity class OrderItem { private Long id; }", "mysql");
    expect(r.ok).toBe(true);
    expect(r.table).toBe("order_item");
  });

  it("Entity·Dto 같은 꼬리는 테이블명에서 뗀다", () => {
    const r = parseSchema("@Entity public class ProductEntity { private Long id; }", "mysql");
    expect(r.table).toBe("product");
  });

  it("방언을 바꾸면 그 방언 타입으로 나온다", () => {
    const r = parseSchema(ENTITY, "oracle");
    const t = (n) => r.fields.find((f) => f.name === n)?.type;
    expect(r.ok).toBe(true);
    expect(t("login_id")).toBe("VARCHAR2");
    expect(t("id")).toBe("NUMBER");
  });
});

describe("스키마 가져오기 — Kotlin data class", () => {
  const KT = `
    @Entity
    @Table(name = "coupon")
    data class Coupon(
        @Id @GeneratedValue val id: Long = 0,
        @Column(length = 40) val code: String,
        val discount: BigDecimal,
        val used: Boolean,
        val expiredAt: LocalDateTime?,
        @ManyToOne @JoinColumn(name = "owner_id") val owner: Member,
        @OneToMany(mappedBy = "coupon") val logs: List<Log> = emptyList()
    )
  `;
  const parsed = parseSchema(KT, "mysql");
  const by = (n) => parsed.fields.find((f) => f.name === n);

  it("코틀린 클래스를 알아본다", () => {
    expect(parsed.ok).toBe(true);
    expect(parsed.source).toBe("kotlin");
    expect(parsed.table).toBe("coupon");
  });

  it("주 생성자 프로퍼티가 컬럼이 된다", () => {
    expect(by("id").type).toBe("BIGINT");
    expect(by("code").type).toBe("VARCHAR");
    expect(by("code").params.length).toBe(40);
    expect(by("discount").type).toBe("DECIMAL");
    expect(by("used").type).toBe("BOOLEAN");
    expect(by("expired_at").type).toBe("DATETIME");
  });

  it("물음표 타입은 NULL 을 허용한다", () => {
    expect(by("expired_at").nullPercent).toBeGreaterThan(0);
    expect(by("code").nullPercent).toBe(0);
  });

  it("연관관계는 자바와 같게 다룬다", () => {
    expect(by("owner_id").type).toBe("BIGINT");
    expect(by("logs")).toBeFalsy();
  });
});

describe("스키마 가져오기 — TypeScript interface", () => {
  const TS = `
    export interface UserRow {
      id: number;
      name: string;
      score?: number;
      active: boolean;
      createdAt: Date;
      tags: string[];
    }
  `;
  const parsed = parseSchema(TS, "postgres");
  const by = (n) => parsed.fields.find((f) => f.name === n);

  it("인터페이스를 알아본다", () => {
    expect(parsed.ok).toBe(true);
    expect(parsed.source).toBe("ts");
  });

  it("타입을 옮긴다", () => {
    expect(by("id").type).toBe("INTEGER");
    expect(by("name").type).toBe("VARCHAR");
    expect(by("active").type).toBe("BOOLEAN");
    expect(by("createdAt").type).toBe("TIMESTAMP");
  });

  it("물음표 프로퍼티는 NULL 을 허용한다", () => {
    expect(by("score").nullPercent).toBeGreaterThan(0);
    expect(by("id").nullPercent).toBe(0);
  });

  it("배열은 JSON 컬럼으로 본다", () => {
    expect(by("tags").type).toBe("JSONB");
  });

  it("TS·JSON 의 이름은 그대로 둔다 (JPA 처럼 자동 변환되지 않으므로)", () => {
    expect(by("createdAt")).toBeTruthy();
  });
});

describe("스키마 가져오기 — JSON", () => {
  const JSON_TEXT = `[
    { "id": 1, "name": "홍길동", "price": 1250.75, "active": true,
      "joinedOn": "2026-01-31", "loggedAt": "2026-01-31 10:20:30",
      "uid": "8f14e45f-ceea-4a1f-a8b2-9a1f7e2c1d55", "meta": { "a": 1 }, "memo": null }
  ]`;
  const parsed = parseSchema(JSON_TEXT, "mysql");
  const by = (n) => parsed.fields.find((f) => f.name === n);

  it("JSON 을 알아본다", () => {
    expect(parsed.ok).toBe(true);
    expect(parsed.source).toBe("json");
  });

  it("값에서 타입을 추론한다", () => {
    expect(by("id").type).toBe("INT");
    expect(by("name").type).toBe("VARCHAR");
    expect(by("price").type).toBe("DECIMAL");
    expect(by("price").params.scale).toBe(2);
    expect(by("active").type).toBe("BOOLEAN");
    expect(by("joinedOn").type).toBe("DATE");
    expect(by("loggedAt").type).toBe("DATETIME");
    expect(by("uid").type).toBe("CHAR");
    expect(by("meta").type).toBe("JSON");
  });

  it("null 인 값은 NULL 허용 문자열로 둔다", () => {
    expect(by("memo").type).toBe("VARCHAR");
    expect(by("memo").nullPercent).toBeGreaterThan(0);
  });

  it("객체 하나만 붙여넣어도 된다", () => {
    const r = parseSchema('{ "a": 1, "b": "x" }', "mysql");
    expect(r.ok).toBe(true);
    expect(r.fields).toHaveLength(2);
  });

  it("여러 행이면 나중 행에서 빠진 타입도 채운다", () => {
    const r = parseSchema('[{ "a": null }, { "a": 12 }]', "mysql");
    expect(r.fields[0].type).toBe("INT");
  });
});

describe("스키마 가져오기 — CSV", () => {
  const CSV = "id,name,price,active,joined_on\n1,홍길동,1250.75,true,2026-01-31\n2,이순신,900,false,2026-02-01";
  const parsed = parseSchema(CSV, "mysql");
  const by = (n) => parsed.fields.find((f) => f.name === n);

  it("CSV 를 알아본다", () => {
    expect(parsed.ok).toBe(true);
    expect(parsed.source).toBe("csv");
  });

  it("헤더가 컬럼명, 첫 데이터 행이 타입 근거다", () => {
    expect(parsed.fields.map((f) => f.name)).toEqual(["id", "name", "price", "active", "joined_on"]);
    expect(by("id").type).toBe("INT");
    expect(by("price").type).toBe("DECIMAL");
    expect(by("active").type).toBe("BOOLEAN");
    expect(by("joined_on").type).toBe("DATE");
  });

  it("탭 구분도 읽는다", () => {
    const r = parseSchema("id\tname\n1\t가나다", "mysql");
    expect(r.ok).toBe(true);
    expect(r.fields.map((f) => f.name)).toEqual(["id", "name"]);
  });

  it("헤더만 있으면 전부 문자열로 둔다", () => {
    const r = parseSchema("aa,bb,cc", "mysql");
    expect(r.ok).toBe(true);
    expect(r.fields).toHaveLength(3);
    expect(r.fields.every((f) => f.type === "VARCHAR")).toBe(true);
  });
});

describe("스키마 가져오기 — 공통", () => {
  it("무엇도 알아보지 못하면 이유를 알려 준다", () => {
    const r = parseSchema("이건 그냥 문장입니다", "mysql");
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("빈 입력을 막는다", () => {
    expect(parseSchema("   ", "mysql").ok).toBe(false);
  });

  it("SQL 은 여전히 SQL 로 읽는다 (다른 파서가 가로채지 않는다)", () => {
    const create = parseSchema("CREATE TABLE t (id INT NOT NULL, nm VARCHAR(20));", "mysql");
    expect(create.source).toBe("sql");
    expect(create.fields).toHaveLength(2);

    const insert = parseSchema("INSERT INTO t (id, nm) VALUES (1, 'a');", "mysql");
    expect(insert.source).toBe("sql");
    expect(insert.fields).toHaveLength(2);
  });

  it("어떤 소스로 읽었든 그 결과로 바로 INSERT 를 만들 수 있다", () => {
    for (const text of [
      "@Entity class A { @Column(length=10) private String nm; private Long id; }",
      '[{ "nm": "x", "id": 1 }]',
      "nm,id\nx,1",
    ]) {
      const r = parseSchema(text, "mysql");
      expect(r.ok, text).toBe(true);
      const rows = generateRows(r.fields, 3, { dialect: "mysql", seed: "s" });
      const sql = toInsertSql(r.fields, rows, { table: r.table, dialect: "mysql" });
      expect(sql).toContain("INSERT INTO");
      expect(sql.split("(").length).toBe(sql.split(")").length);
    }
  });
});

describe("문자열 기본값", () => {
  it("기본 문자셋은 읽을 수 있는 랜덤 영숫자다 — 한글은 골라야 나온다", () => {
    const field = createField("mysql", "VARCHAR", "s");
    const rows = generateRows([field], 40, { dialect: "mysql", seed: "x" });
    const all = rows.map((r) => r.s).join("");
    expect(all.length).toBeGreaterThan(0);
    expect(/[가-힣]/.test(all)).toBe(false);
    expect(/^[A-Za-z0-9]+$/.test(all)).toBe(true);
  });

  it("한글을 고르면 한글이 나온다", () => {
    const rows = generateRows(
      [{ ...createField("mysql", "VARCHAR", "s"), params: { length: 20, charset: "korean" } }],
      20, { dialect: "mysql", seed: "x" }
    );
    expect(/[가-힣]/.test(rows.map((r) => r.s).join(""))).toBe(true);
  });
});
