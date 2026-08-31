// SQL 방언 규칙의 단일 출처.
//
// 식별자를 어떻게 감싸는지, 불리언을 뭐라고 쓰는지는 DB 마다 다르다.
// 이걸 도구마다 따로 구현하면 반드시 어긋난다 — 실제로 /dummy 는 감쌌는데
// /convert 는 안 감싸서, 같은 컬럼명이 한쪽에서만 깨졌다. 그래서 한 곳에 둔다.
//
// 쓰는 곳: lib/dummy.js(DB 더미데이터) · lib/csvTool.js(데이터 형식 변환)

export const SQL_DIALECTS = [
  { key: "mysql", label: "MySQL / MariaDB" },
  { key: "postgres", label: "PostgreSQL" },
  { key: "oracle", label: "Oracle" },
  { key: "mssql", label: "SQL Server" },
  { key: "sqlite", label: "SQLite" },
];

export const DIALECT = {
  mysql: {
    quote: (s) => `\`${s.replace(/`/g, "``")}\``,
    bool: (v) => (v ? "1" : "0"), batch: true, comment: "inline",
  },
  postgres: {
    quote: (s) => `"${s.replace(/"/g, '""')}"`,
    bool: (v) => (v ? "TRUE" : "FALSE"), batch: true, comment: "statement",
  },
  oracle: {
    quote: (s) => `"${s.replace(/"/g, '""')}"`,
    bool: (v) => (v ? "1" : "0"), batch: false, comment: "statement",
    byteLength: true, wrapDate: true,
  },
  mssql: {
    quote: (s) => `[${s.replace(/]/g, "]]")}]`,
    bool: (v) => (v ? "1" : "0"), batch: true, comment: "none",
  },
  sqlite: {
    quote: (s) => `"${s.replace(/"/g, '""')}"`,
    bool: (v) => (v ? "1" : "0"), batch: true, comment: "none",
  },
};

/** 모르는 방언이 와도 멈추지 않는다 — MySQL 이 가장 흔하다 */
export const dialectOf = (key) => DIALECT[key] || DIALECT.mysql;

/** SQL 문자열 리터럴. 홑따옴표는 두 번 써서 escape 한다(표준). */
export const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * JS 값 하나를 SQL 리터럴로.
 *
 * <p>따옴표를 붙일지가 핵심이다 — `'30'` 은 문자열이라 INT 컬럼에서 방언에 따라
 * 거부되고, `''` 는 NULL 이 아니라 빈 문자열이라 NOT NULL 검사를 통과해 버린다.
 * 객체·배열은 JSON 문자열로 넣는다(JSON·JSONB 컬럼에 그대로 들어가는 형태다).
 *
 * @param {*} value 넣을 값
 * @param {object} d dialectOf() 로 얻은 방언 규칙
 * @param {string} [kind] "date" | "datetime" — Oracle 의 TO_DATE 감싸기에만 쓴다
 */
export function sqlValue(value, d, kind) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return d.bool(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "object") return sqlString(JSON.stringify(value));
  if (d.wrapDate && kind === "date") return `TO_DATE(${sqlString(value)}, 'YYYY-MM-DD')`;
  if (d.wrapDate && kind === "datetime") return `TO_DATE(${sqlString(value)}, 'YYYY-MM-DD HH24:MI:SS')`;
  return sqlString(value);
}

/**
 * 타입이 없는 칸(CSV·마크다운 표)을 JS 값으로 본다.
 *
 * <p>CSV 에는 타입이 없어서 빈 칸이 NULL 인지 빈 문자열인지 구분할 수 없다.
 * NULL 로 본다 — 표에서 빈 칸은 "값이 없다"는 뜻으로 쓰이는 쪽이 압도적이다.
 * **앞자리 0 은 문자열로 남긴다**(사번·우편번호·전화번호가 숫자가 되면 0 이 날아간다).
 */
export function coerceCell(raw) {
  const s = String(raw ?? "").trim();
  if (s === "" || /^(null|NULL)$/.test(s)) return null;
  if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(s) && s.length <= 15) return Number(s);
  return String(raw);
}
