import { SQL_DIALECTS, DIALECT, dialectOf, sqlString, sqlValue } from "./sqlDialect.js";
// DB 더미데이터 생성기 — 전부 클라이언트(NFR-02).
//
// 범위: **DB 더미데이터(data.sql) 전용**이다. "테스트 데이터 일반"이 아니다.
// 그래서 주(主)가 되는 건 생성기가 아니라 **DB 컬럼의 데이터타입**이다:
//
//   DB 선택 → 그 DB 의 데이터타입 목록 → 컬럼마다 타입·길이 지정 → 값은 타입이 결정
//
//   필드 = { name(컬럼명), type(데이터타입), params(길이·정밀도·범위), note(비고), nullPercent }
//   비고(note)는 사람이 읽는 메모다. 값 생성에는 영향이 없고, CREATE TABLE 의 컬럼 주석으로 나간다.
//
// 한국에서 특히 중요한 것: **문자 길이의 단위가 DB 마다 다르다.**
//   MySQL·PostgreSQL VARCHAR(n) = n **글자** → 한글도 n 자
//   Oracle VARCHAR2(n)·SQL Server VARCHAR(n) = n **바이트** → 한글은 n/3 자
//   이걸 무시하고 한글을 채우면 INSERT 가 실패한다. 아래 fitString 이 방언별로 맞춘다.

import { uuidV4 } from "./uuid.js";

/** 한 번에 만들 수 있는 최대 행 수. 성능 한계가 아니라 실수 방지용 안전장치다. */
export const MAX_ROWS = 500;

/** 문자열 값의 기본 길이 상한 — VARCHAR(255) 를 꽉 채우면 읽기만 나빠진다. */
const DEFAULT_MAX_TEXT = 12;

// ── 난수 ───────────────────────────────────────────────────
const POOL_SIZE = 1024;
let pool = new Uint32Array(0);
let poolIndex = 0;

function cryptoRand(n) {
  if (n <= 0) return 0;
  const limit = Math.floor(0xffffffff / n) * n;
  let v;
  do {
    if (poolIndex >= pool.length) {
      pool = new Uint32Array(POOL_SIZE);
      crypto.getRandomValues(pool);
      poolIndex = 0;
    }
    v = pool[poolIndex++];
  } while (v >= limit); // 모듈로 편향 제거
  return v % n;
}

/** 시드 문자열 → 32비트 정수 (FNV-1a) */
function hashSeed(seed) {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 시드가 있으면 결정적 난수(mulberry32), 없으면 CSPRNG. 같은 데이터를 다시 뽑을 때 쓴다. */
export function buildRandom(seed) {
  if (seed === undefined || seed === null || String(seed).trim() === "") return cryptoRand;
  let state = hashSeed(seed);
  return function seededRand(n) {
    if (n <= 0) return 0;
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n) | 0;
  };
}

let R = cryptoRand;
const rand = (n) => R(n);
const randBetween = (min, max) => (max <= min ? min : min + R(max - min + 1));

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** DECIMAL(p,s) 정규화 — s 는 0 이상이며 p 를 넘을 수 없다(넘으면 SQL 문법 오류다) */
function decimalShape(params) {
  const precision = num(params.precision, NaN);
  let scale = Math.max(0, Math.min(30, num(params.scale, 2)));
  if (Number.isFinite(precision)) scale = Math.min(scale, Math.max(0, precision));
  return { precision, scale };
}

// ── 값 생성 ────────────────────────────────────────────────
const encoder = new TextEncoder();

// 기본은 영문+숫자다. 한글 음절을 무작위로 뽑으면 "쎍옠씵쀪" 같은 글자가 나오는데,
// 더미데이터로 못 쓸 건 없어도 눈으로 훑기 어렵다. 한글이 필요하면 골라 쓰면 된다.
export const CHARSETS = [
  { key: "mixed", label: "영문+숫자" },
  { key: "alpha", label: "영문" },
  { key: "digit", label: "숫자" },
  { key: "korean", label: "한글" },
];

const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGIT = "0123456789";
const HANGUL_BASE = 0xac00;

// 한글은 **자모를 골라 조합한다.** 완성형 11,172자에서 균등하게 뽑으면
// "뜃뭸퀥냺멛뤡" 같은 글자만 나온다 — 그 대부분이 문법상 가능할 뿐 실제로는
// 쓰이지 않는 조합(겹받침 ㄽㄾㄿ, 이중모음 ㅙㅞ, 된소리 초성)이기 때문이다.
// 더미데이터라 뜻은 없어도 되지만 한국어처럼 보이기는 해야 한다.
//
// 아래는 실제 한국어에서 흔한 자모만 남긴 것이다. 640가지 음절이 나오고,
// 10자짜리 값이면 10^28 가지라 더미데이터에는 넘치도록 충분하다.
const CHO_COMMON = [0, 2, 3, 5, 6, 7, 9, 11, 12, 18];   // ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅎ
const JUNG_COMMON = [0, 1, 4, 5, 8, 13, 18, 20];        // ㅏㅐㅓㅔㅗㅜㅡㅣ
// 0(받침 없음)을 여러 번 넣어 절반쯤만 받침이 붙게 한다 — 실제 한국어의 비율에 가깝다.
// 전부 받침이면 "각난달", 전혀 없으면 "가나다" 처럼 어색해진다.
const JONG_COMMON = [0, 0, 0, 0, 0, 0, 0, 1, 4, 8, 16, 17, 19, 21]; // ∅ㄱㄴㄹㅁㅂㅅㅇ

function randomHangul() {
  const cho = CHO_COMMON[rand(CHO_COMMON.length)];
  const jung = JUNG_COMMON[rand(JUNG_COMMON.length)];
  const jong = JONG_COMMON[rand(JONG_COMMON.length)];
  return String.fromCharCode(HANGUL_BASE + cho * 21 * 28 + jung * 28 + jong);
}
/** UTF-8 에서 한 글자가 차지하는 바이트 — 바이트 기준 길이(Oracle·SQL Server)를 계산할 때 쓴다 */
const BYTES_PER_CHAR = { korean: 3, alpha: 1, digit: 1, mixed: 1 };

function randomChar(charset) {
  if (charset === "korean") return randomHangul();
  if (charset === "digit") return DIGIT[rand(DIGIT.length)];
  if (charset === "mixed") {
    const s = ALPHA + DIGIT;
    return s[rand(s.length)];
  }
  return ALPHA[rand(ALPHA.length)];
}

/**
 * 선언 길이에 맞는 문자열을 만든다.
 * byteSemantics 면 길이를 **바이트**로 해석한다(Oracle VARCHAR2, SQL Server VARCHAR).
 * exact 면 정확히 그 길이로 채운다(CHAR).
 */
function fitString(params, { byteSemantics, exact }) {
  let charset = params.charset || "mixed";
  const declared = Math.max(1, num(params.length, 255));

  // 바이트 기준이면 한 글자가 몇 바이트인지로 나눠 글자 수 상한을 구한다
  let bytesPerChar = byteSemantics ? BYTES_PER_CHAR[charset] || 1 : 1;
  // 선언 길이가 그 문자 한 자도 못 담으면(예: Oracle VARCHAR2(2) 에 한글 3바이트)
  // 빈 값을 내는 대신 1바이트 문자로 떨어진다 — NOT NULL 컬럼에 빈 문자열은 쓸모가 없다
  if (byteSemantics && declared < bytesPerChar) {
    charset = "alpha";
    bytesPerChar = 1;
  }
  const maxChars = Math.max(1, Math.floor(declared / bytesPerChar));

  let lo = Math.max(1, num(params.minLength, 3));
  let hi = num(params.maxLength, DEFAULT_MAX_TEXT);
  if (exact) lo = hi = maxChars;
  hi = Math.min(hi, maxChars);
  lo = Math.min(lo, hi);

  let out = "";
  const target = randBetween(lo, hi);
  for (let i = 0; i < target; i++) out += randomChar(charset);

  // 바이트 상한을 넘으면(가변 폭 문자) 끝에서 잘라 맞춘다
  if (byteSemantics) {
    while (out.length > 1 && encoder.encode(out).length > declared) out = out.slice(0, -1);
    if (encoder.encode(out).length > declared) out = randomChar("alpha"); // 마지막 한 자도 안 들어가면 ASCII
  }
  return out;
}

const DAY_MS = 86400000;
const pad2 = (n) => String(n).padStart(2, "0");

// DATE·DATETIME 은 SQL 에서 파라미터가 없는 타입이라 옵션 칸도 비운다.
// 생성 범위는 최근 5년으로 고정한다 — 더미데이터에 그 이상의 조절은 필요하지 않았다.
const DATE_FROM = Date.UTC(2021, 0, 1);
const DATE_TO = Date.UTC(2025, 11, 31);
const DATE_SPAN = Math.floor((DATE_TO - DATE_FROM) / DAY_MS) + 1;

function randomDate() {
  return new Date(DATE_FROM + rand(DATE_SPAN) * DAY_MS).toISOString().slice(0, 10);
}

const randomTime = () => `${pad2(rand(24))}:${pad2(rand(60))}:${pad2(rand(60))}`;

/** kind 별 값 생성. type 은 범위(min/max)를 갖는 정수 타입에서 쓴다. */
function generateValue(type, params, dialect) {
  switch (type.kind) {
    case "string":
      return fitString(params, {
        byteSemantics: type.byteLength ?? DIALECT[dialect]?.byteLength ?? false,
        exact: type.exact,
      });
    case "int": {
      const lo = Math.max(num(params.min, type.min ?? 0), type.min ?? -Infinity);
      const hi = Math.min(num(params.max, type.max ?? 1000), type.max ?? Infinity);
      return randBetween(Math.ceil(lo), Math.floor(hi));
    }
    case "decimal": {
      const { scale, precision } = decimalShape(params);
      const factor = 10 ** scale;
      let lo = num(params.min, 0);
      let hi = num(params.max, 10000);

      // DECIMAL(p,s) 가 담을 수 있는 최대는 10^(p-s) - 10^-s 다.
      // 이걸 넘는 값을 만들면 실제 INSERT 가 실패한다 — 사용자 min/max 보다 타입이 우선이다.
      if (Number.isFinite(precision)) {
        const limit = 10 ** (precision - scale) - 1 / factor;
        lo = Math.max(lo, -limit);
        hi = Math.min(hi, limit);
        if (hi < lo) { lo = 0; hi = limit; }
      }
      return randBetween(Math.round(lo * factor), Math.round(hi * factor)) / factor;
    }
    case "bool":
      return rand(2) === 1;
    case "date":
      return randomDate();
    case "datetime":
      return `${randomDate()} ${randomTime()}`;
    case "time":
      return randomTime();
    case "uuid":
      return uuidV4();
    case "json":
      return JSON.stringify({ id: rand(1000), name: fitString({ charset: "alpha", length: 8 }, {}), active: rand(2) === 1 });
    default:
      return "";
  }
}

// ── 데이터타입 파라미터 정의 (화면이 이걸 보고 입력칸을 그린다) ──
const P = {
  length: (def) => ({ key: "length", label: "길이", kind: "number", default: def }),
  charset: { key: "charset", label: "문자", kind: "select", options: CHARSETS, default: "mixed" },
  minMax: (min, max) => [
    { key: "min", label: "최소", kind: "number", default: min },
    { key: "max", label: "최대", kind: "number", default: max },
  ],
  precision: [
    { key: "precision", label: "전체 자릿수", kind: "number", default: 12 },
    { key: "scale", label: "소수 자릿수", kind: "number", default: 2 },
  ],
};

const str = (key, defLen, extra = {}) => ({
  key, kind: "string",
  params: [P.length(defLen), P.charset],
  ddl: (p) => `${key}(${Math.max(1, num(p.length, defLen))})`,
  ...extra,
});
const strNoLen = (key, extra = {}) => ({ key, kind: "string", params: [P.charset], ddl: () => key, ...extra });
const int = (key, min, max, extra = {}) => ({
  key, kind: "int", min, max,
  params: P.minMax(Math.max(min, 0), Math.min(max, 10000)),
  ddl: () => key,
  ...extra,
});
const dec = (key, extra = {}) => ({
  key, kind: "decimal",
  params: [...P.precision, ...P.minMax(0, 10000)],
  ddl: (p) => {
    const shape = decimalShape(p);
    const precision = Number.isFinite(shape.precision) ? shape.precision : 12;
    return `${key}(${precision},${shape.scale})`;
  },
  ...extra,
});
const plain = (key, kind, params = [], extra = {}) => ({ key, kind, params, ddl: () => key, ...extra });

const INT32 = [-2147483648, 2147483647];
const INT64 = [-9007199254740991, 9007199254740991]; // JS 안전 정수 범위로 제한

/** DB 방언별 데이터타입 목록. 그 DB 에 실제로 있는 타입만 넣는다. */
export const DB_TYPES = {
  mysql: [
    str("VARCHAR", 255),
    str("CHAR", 10, { exact: true }),
    strNoLen("TEXT"),
    int("TINYINT", -128, 127),
    int("SMALLINT", -32768, 32767),
    int("INT", ...INT32),
    int("BIGINT", ...INT64),
    dec("DECIMAL"),
    plain("FLOAT", "decimal", [...P.minMax(0, 10000), { key: "scale", label: "소수 자릿수", kind: "number", default: 2 }]),
    plain("DOUBLE", "decimal", [...P.minMax(0, 10000), { key: "scale", label: "소수 자릿수", kind: "number", default: 4 }]),
    plain("BOOLEAN", "bool"),
    plain("DATE", "date"),
    plain("DATETIME", "datetime"),
    plain("TIMESTAMP", "datetime"),
    plain("TIME", "time"),
    plain("JSON", "json"),
  ],
  postgres: [
    str("VARCHAR", 255),
    str("CHAR", 10, { exact: true }),
    strNoLen("TEXT"),
    int("SMALLINT", -32768, 32767),
    int("INTEGER", ...INT32),
    int("BIGINT", ...INT64),
    dec("NUMERIC"),
    plain("REAL", "decimal", [...P.minMax(0, 10000), { key: "scale", label: "소수 자릿수", kind: "number", default: 2 }]),
    plain("DOUBLE PRECISION", "decimal", [...P.minMax(0, 10000), { key: "scale", label: "소수 자릿수", kind: "number", default: 4 }]),
    plain("BOOLEAN", "bool"),
    plain("DATE", "date"),
    plain("TIMESTAMP", "datetime"),
    plain("TIME", "time"),
    plain("UUID", "uuid"),
    plain("JSONB", "json"),
  ],
  oracle: [
    // Oracle 은 기본이 바이트 단위다 — VARCHAR2(20) 에 한글은 6자까지
    str("VARCHAR2", 255, { byteLength: true }),
    str("CHAR", 10, { exact: true, byteLength: true }),
    strNoLen("CLOB"),
    dec("NUMBER"),
    plain("DATE", "datetime"), // Oracle DATE 는 시각까지 갖는다
    plain("TIMESTAMP", "datetime"),
  ],
  mssql: [
    str("VARCHAR", 255, { byteLength: true }),  // 바이트 기준
    str("NVARCHAR", 255),                        // 유니코드(글자 기준)
    str("CHAR", 10, { exact: true, byteLength: true }),
    strNoLen("TEXT"),
    int("TINYINT", 0, 255), // MySQL 과 달리 부호 없음
    int("SMALLINT", -32768, 32767),
    int("INT", ...INT32),
    int("BIGINT", ...INT64),
    dec("DECIMAL"),
    plain("FLOAT", "decimal", [...P.minMax(0, 10000), { key: "scale", label: "소수 자릿수", kind: "number", default: 2 }]),
    plain("BIT", "bool"),
    plain("DATE", "date"),
    plain("DATETIME2", "datetime"),
    plain("TIME", "time"),
    plain("UNIQUEIDENTIFIER", "uuid"),
  ],
  // SQLite 는 고정 타입이 아니라 **타입 친화성(affinity)** 이다.
  // 아래 이름들은 전부 SQLite 가 받아들이는 선언이며 실제 스키마에서 널리 쓰인다
  // (VARCHAR→TEXT, BOOLEAN·DATETIME→NUMERIC 친화성).
  // BLOB 은 뺐다 — 바이너리를 더미 텍스트로 채우는 건 맞지 않는다.
  sqlite: [
    strNoLen("TEXT"),
    str("VARCHAR", 255),
    int("INTEGER", ...INT64),
    plain("REAL", "decimal", [...P.minMax(0, 10000), { key: "scale", label: "소수 자릿수", kind: "number", default: 2 }]),
    plain("NUMERIC", "decimal", [...P.minMax(0, 10000), { key: "scale", label: "소수 자릿수", kind: "number", default: 2 }]),
    plain("BOOLEAN", "bool"),
    plain("DATE", "date"),
    plain("DATETIME", "datetime"),
  ],
};

export function getDbType(dialect, key) {
  return (DB_TYPES[dialect] || []).find((t) => t.key === key) || null;
}

/** DDL 에 쓸 타입 표기 — VARCHAR(20), DECIMAL(10,3) 등 */
export function renderType(dialect, field) {
  const type = getDbType(dialect, field?.type);
  if (!type) return "";
  return type.ddl(field.params || {});
}

/** 그 방언의 데이터타입으로 필드 한 줄을 만든다 */
export function createField(dialect, typeKey, name) {
  const list = DB_TYPES[dialect] || DB_TYPES.mysql;
  const type = list.find((t) => t.key === typeKey) || list[0];
  const params = {};
  for (const p of type.params || []) params[p.key] = p.default;
  return { name: name === undefined ? "" : name, type: type.key, params, note: "", nullPercent: 0 };
}

/** 사용자가 정의한 컬럼대로 count 행 생성 */
export function generateRows(fields, count, { seed, dialect = "mysql" } = {}) {
  const n = Math.max(1, Math.min(MAX_ROWS, Math.floor(num(count, 1))));
  const usable = (fields || []).filter((f) => f && String(f.name || "").trim() !== "");

  const prev = R;
  R = buildRandom(seed);
  try {
    return Array.from({ length: n }, () => {
      const row = {};
      for (const f of usable) {
        const type = getDbType(dialect, f.type);
        if (!type) continue;
        const nullPct = Math.max(0, Math.min(100, num(f.nullPercent, 0)));
        row[f.name] = nullPct > 0 && rand(100) < nullPct ? null : generateValue(type, f.params || {}, dialect);
      }
      return row;
    });
  } finally {
    R = prev;
  }
}

// ── 정렬 (ORDER BY) ────────────────────────────────────────
// 한글은 코드포인트 순서와 가나다 순서가 달라 Intl.Collator 로 비교한다.
const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

/**
 * 생성한 행을 한 컬럼 기준으로 정렬한다 — 만들어진 data.sql 이 ORDER BY 를 태운 것처럼 보이게.
 * NULL 은 방향과 관계없이 뒤로 보낸다(대부분의 DB 의 NULLS LAST 관행).
 */
export function sortRows(fields, rows, { by, dir = "asc" } = {}) {
  const list = [...(rows || [])];
  if (!by) return list;
  const field = (fields || []).find((f) => f && f.name === by);
  if (!field) return list;

  const sign = dir === "desc" ? -1 : 1;
  return list.sort((ra, rb) => {
    const a = ra[by];
    const b = rb[by];
    // NULL 은 항상 뒤 — 오름차순이든 내림차순이든
    const aNull = a === null || a === undefined;
    const bNull = b === null || b === undefined;
    if (aNull || bNull) return aNull && bNull ? 0 : aNull ? 1 : -1;

    if (typeof a === "number" && typeof b === "number") return (a - b) * sign;
    if (typeof a === "boolean" && typeof b === "boolean") return (Number(a) - Number(b)) * sign;
    return collator.compare(String(a), String(b)) * sign;
  });
}

// ── 내보내기 ───────────────────────────────────────────────
const usableFields = (fields) => (fields || []).filter((f) => f && String(f.name || "").trim() !== "");
const names = (fields) => usableFields(fields).map((f) => f.name);

function csvCell(value, delimiter) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return new RegExp(`["\\n\\r${delimiter === "\t" ? "\\t" : ","}]`).test(s)
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/** bom: 엑셀은 BOM 이 없으면 UTF-8 한글을 CP949 로 읽어 깨뜨린다 — 한국에서는 사실상 필수. */
export function toCsv(fields, rows, { header = true, lineEnding = "lf", bom = false, delimiter = "," } = {}) {
  const keys = names(fields);
  if (!keys.length) return "";
  const nl = lineEnding === "crlf" ? "\r\n" : "\n";
  const lines = [];
  if (header) lines.push(keys.map((k) => csvCell(k, delimiter)).join(delimiter));
  for (const r of rows) lines.push(keys.map((k) => csvCell(r[k], delimiter)).join(delimiter));
  return (bom ? "﻿" : "") + lines.join(nl);
}

export function toJson(fields, rows, { pretty = true } = {}) {
  const keys = names(fields);
  const picked = rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null])));
  return JSON.stringify(picked, null, pretty ? 2 : 0);
}

// ── SQL ────────────────────────────────────────────────────
// 방언 규칙(식별자 인용·불리언 표기)은 lib/sqlDialect.js 가 단일 출처다.
// 데이터 형식 변환기(csvTool.js)도 같은 표를 쓴다 — 따로 두면 반드시 어긋난다.
export { SQL_DIALECTS };




/** INSERT 문 생성. batch=true 면 한 문장에 여러 VALUES(Oracle 은 문법상 미지원). */
export function toInsertSql(fields, rows, { table = "sample", dialect = "mysql", batch = false } = {}) {
  const usable = usableFields(fields);
  if (!usable.length || !rows.length) return "";

  const d = dialectOf(dialect);
  const tbl = d.quote(table || "sample");
  const cols = usable.map((f) => d.quote(f.name)).join(", ");
  const tuple = (r) =>
    `(${usable.map((f) => sqlValue(r[f.name], d, getDbType(dialect, f.type)?.kind)).join(", ")})`;

  if (batch && d.batch) {
    return `INSERT INTO ${tbl} (${cols}) VALUES\n${rows.map((r) => `  ${tuple(r)}`).join(",\n")};`;
  }
  return rows.map((r) => `INSERT INTO ${tbl} (${cols}) VALUES ${tuple(r)};`).join("\n");
}

/**
 * CREATE TABLE 생성.
 * 비고(note)는 그 DB 가 지원하는 방식으로 컬럼 주석이 된다 —
 * MySQL 은 컬럼 뒤 COMMENT, PostgreSQL·Oracle 은 별도 COMMENT ON COLUMN 문, 나머지는 `--` 주석.
 */
export function toCreateTable(fields, { table = "sample", dialect = "mysql" } = {}) {
  const usable = usableFields(fields);
  if (!usable.length) return "";

  const d = dialectOf(dialect);
  const tbl = d.quote(table || "sample");

  const lines = usable.map((f) => {
    const notNull = num(f.nullPercent, 0) > 0 ? "" : " NOT NULL";
    const note = String(f.note || "").trim();
    let line = `  ${d.quote(f.name)} ${renderType(dialect, f)}${notNull}`;
    if (note && d.comment === "inline") line += ` COMMENT ${sqlString(note)}`;
    else if (note && d.comment === "none") line += `  -- ${note}`;
    return line;
  });

  let ddl = `CREATE TABLE ${tbl} (\n${lines.join(",\n")}\n);`;

  if (d.comment === "statement") {
    const comments = usable
      .filter((f) => String(f.note || "").trim())
      .map((f) => `COMMENT ON COLUMN ${tbl}.${d.quote(f.name)} IS ${sqlString(f.note.trim())};`);
    if (comments.length) ddl += `\n${comments.join("\n")}`;
  }
  return ddl;
}

// ── SQL 가져오기 ───────────────────────────────────────────
// 실제 흐름은 "이미 있는 테이블에 넣을 데이터를 만드는 것"이다.
// 그래서 CREATE TABLE 이나 INSERT 문을 붙여넣으면 컬럼 정의가 만들어지게 한다.
//
// 완전한 SQL 파서가 아니다. 실무에서 붙여넣는 형태(DDL 덤프, INSERT 한 줄)를
// 읽어내는 데 초점을 두고, 못 읽는 건 경고로 알린다.

/** 방언별 별칭 — 파싱한 타입명을 그 방언의 실제 타입으로 옮긴다 */
const TYPE_ALIASES = {
  INT: ["INT", "INTEGER", "NUMBER"],
  BIGINT: ["BIGINT", "INTEGER", "NUMBER"],
  SMALLINT: ["SMALLINT", "INTEGER", "NUMBER"],
  TINYINT: ["TINYINT", "SMALLINT", "INTEGER", "NUMBER"],
  VARCHAR: ["VARCHAR", "VARCHAR2", "NVARCHAR", "TEXT"],
  CHAR: ["CHAR", "VARCHAR", "VARCHAR2", "TEXT"],
  TEXT: ["TEXT", "CLOB", "VARCHAR", "VARCHAR2"],
  DECIMAL: ["DECIMAL", "NUMERIC", "NUMBER", "REAL"],
  FLOAT: ["FLOAT", "REAL", "DOUBLE", "DOUBLE PRECISION", "NUMBER", "NUMERIC"],
  BOOLEAN: ["BOOLEAN", "BIT", "TINYINT", "NUMBER"],
  DATE: ["DATE"],
  DATETIME: ["DATETIME", "TIMESTAMP", "DATETIME2", "DATE"],
  TIME: ["TIME"],
  UUID: ["UUID", "UNIQUEIDENTIFIER", "CHAR", "VARCHAR", "VARCHAR2"],
  JSON: ["JSON", "JSONB", "TEXT", "CLOB"],
};

/** SERIAL 계열 등 "쓰기 편한 별칭"을 실제 저장 타입으로 먼저 정규화한다 */
const NORMALIZE = {
  SERIAL: "INT", BIGSERIAL: "BIGINT", SMALLSERIAL: "SMALLINT",
  BOOL: "BOOLEAN", "CHARACTER VARYING": "VARCHAR", CHARACTER: "CHAR",
  "DOUBLE PRECISION": "FLOAT", DOUBLE: "FLOAT",
  TIMESTAMPTZ: "DATETIME", SMALLDATETIME: "DATETIME", DATETIME2: "DATETIME",
  LONGTEXT: "TEXT", MEDIUMTEXT: "TEXT", NTEXT: "TEXT", CLOB: "TEXT",
  NVARCHAR: "VARCHAR", VARCHAR2: "VARCHAR", NCHAR: "CHAR", BPCHAR: "CHAR",
  INT4: "INT", INT8: "BIGINT", INT2: "SMALLINT", MONEY: "DECIMAL",
  JSONB: "JSON", UNIQUEIDENTIFIER: "UUID", BIT: "BOOLEAN",
};

/** 그 방언에서 쓸 수 있는 타입으로 옮긴다. 못 찾으면 null. */
function mapType(rawType, dialect) {
  const upper = String(rawType || "").toUpperCase().trim();

  // 1) 그 방언에 같은 이름이 그대로 있으면 우선한다 (Oracle VARCHAR2, MSSQL NVARCHAR 등)
  if (getDbType(dialect, upper)) return upper;

  const canonical = NORMALIZE[upper] || upper;
  if (getDbType(dialect, canonical)) return canonical;

  // 2) 별칭 무리에서 그 방언이 가진 것을 찾는다
  const group = TYPE_ALIASES[canonical]
    || Object.values(TYPE_ALIASES).find((g) => g.includes(canonical));
  if (group) {
    for (const candidate of group) {
      if (getDbType(dialect, candidate)) return candidate;
    }
  }
  return null;
}

/** DDL 에 쓰인 타입·문법으로 어느 DB 인지 추측한다 */
function detectDialect(sql) {
  const s = sql.toUpperCase();
  if (/\bVARCHAR2\b|\bCLOB\b|\bNUMBER\s*\(/.test(s)) return "oracle";
  if (/\bNVARCHAR\b|\bDATETIME2\b|\bUNIQUEIDENTIFIER\b|\[\w+\]/.test(s)) return "mssql";
  if (/\bJSONB\b|\bBIGSERIAL\b|\bSERIAL\b|COMMENT\s+ON\s+COLUMN/.test(s)) return "postgres";
  if (/AUTO_INCREMENT|ENGINE\s*=|`/.test(sql)) return "mysql";
  if (/\bAUTOINCREMENT\b/.test(s)) return "sqlite";
  return "mysql";
}

/** 식별자에서 따옴표류를 벗긴다 — `a` "a" [a] */
const unquote = (s) => String(s || "").trim().replace(/^[`"[]/, "").replace(/[`"\]]$/, "").trim();

/** 컬럼 정의가 아니라 제약조건·인덱스 줄인가 */
const isConstraint = (line) =>
  /^\s*(PRIMARY\s+KEY|UNIQUE(\s+(KEY|INDEX))?|KEY|INDEX|CONSTRAINT|FOREIGN\s+KEY|CHECK|FULLTEXT|SPATIAL)\b/i.test(line);

/** 괄호 깊이를 세며 최상위 쉼표로만 자른다 (DECIMAL(12,2) 가 쪼개지지 않게) */
function splitTopLevel(body) {
  const out = [];
  let depth = 0, cur = "", quote = null;
  for (const ch of body) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; cur += ch; continue; }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** 첫 괄호 쌍 안을 꺼낸다 */
function extractBody(sql) {
  const open = sql.indexOf("(");
  if (open < 0) return null;
  let depth = 0, quote = null;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return sql.slice(open + 1, i);
    }
  }
  return null;
}

function parseCreateTable(sql, dialect, warnings) {
  const nameMatch = sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:GLOBAL\s+TEMPORARY\s+|TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/i);
  const table = unquote(String(nameMatch ? nameMatch[1] : "").split(".").pop()) || "sample";

  const body = extractBody(sql);
  if (!body) return { table, fields: [] };

  const fields = [];
  for (const rawLine of splitTopLevel(body)) {
    const line = rawLine.trim();
    if (!line || isConstraint(line)) continue;

    const m = line.match(/^([`"[]?[\w가-힣$#]+[`"\]]?)\s+([A-Za-z_][A-Za-z0-9_]*(?:\s+(?:VARYING|PRECISION))?)\s*(\([^)]*\))?/);
    if (!m) continue;

    const name = unquote(m[1]);
    const rawType = m[2].trim();
    const args = (m[3] || "").replace(/[()]/g, "").split(",")
      .map((s) => Number(s.trim())).filter(Number.isFinite);

    // MySQL 의 TINYINT(1) 은 관례상 불리언이다(BOOLEAN 이 이것의 별칭). 폭이 1 일 때만.
    const effectiveType = /^(TINYINT|BIT)$/i.test(rawType) && args[0] === 1 ? "BOOLEAN" : rawType;

    const mapped = mapType(effectiveType, dialect);
    if (!mapped) {
      warnings.push(`${name}: ${rawType.toUpperCase()} 는 이 도구가 모르는 타입이라 기본 타입으로 넣었습니다.`);
    }

    const field = createField(dialect, mapped || DB_TYPES[dialect][0].key, name);
    if (args.length) {
      if (field.params.length !== undefined) field.params.length = args[0];
      if (field.params.precision !== undefined) field.params.precision = args[0];
      if (field.params.scale !== undefined && args.length > 1) field.params.scale = args[1];
    }

    // NOT NULL 이 없으면 그 컬럼은 NULL 을 허용한다는 뜻 — 값에도 조금 섞는다
    field.nullPercent = /\bNOT\s+NULL\b/i.test(line) ? 0 : 10;

    const comment = line.match(/COMMENT\s+'((?:[^']|'')*)'/i);
    if (comment) field.note = comment[1].replace(/''/g, "'");

    fields.push(field);
  }
  return { table, fields };
}

/** PostgreSQL·Oracle 스타일의 별도 주석문에서 비고를 채운다 */
function applyColumnComments(sql, fields) {
  for (const m of sql.matchAll(/COMMENT\s+ON\s+COLUMN\s+(\S+)\s+IS\s+'((?:[^']|'')*)'/gi)) {
    const column = unquote(m[1].split(".").pop());
    const field = fields.find((f) => f.name === column);
    if (field) field.note = m[2].replace(/''/g, "'");
  }
}

/** INSERT 문의 첫 VALUES 튜플로 타입을 추론한다 */
function inferTypeFromValue(raw, dialect) {
  const v = String(raw).trim();
  if (/^NULL$/i.test(v)) return { type: mapType("VARCHAR", dialect), params: {} };
  if (/^(TRUE|FALSE)$/i.test(v)) return { type: mapType("BOOLEAN", dialect), params: {} };
  if (/^-?\d+$/.test(v)) return { type: mapType("INT", dialect), params: {} };
  if (/^-?\d+\.\d+$/.test(v)) {
    const scale = v.split(".")[1].length;
    return { type: mapType("DECIMAL", dialect), params: { precision: 12, scale } };
  }

  const str = v.replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'");
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return { type: mapType("DATE", dialect), params: {} };
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(str)) return { type: mapType("DATETIME", dialect), params: {} };
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) return { type: mapType("TIME", dialect), params: {} };

  // 값 길이보다 넉넉하게 잡는다(다른 행이 더 길 수 있다)
  const length = Math.min(4000, Math.max(20, Math.ceil((str.length * 2) / 10) * 10));
  return { type: mapType("VARCHAR", dialect), params: { length } };
}

function parseInsert(sql, dialect) {
  const m = sql.match(/INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]*)\)/i);
  if (!m) return { table: "sample", fields: [] };

  const table = unquote(m[1].split(".").pop()) || "sample";
  const columns = m[2].split(",").map((c) => unquote(c)).filter(Boolean);

  const valuesAt = sql.search(/VALUES\s*\(/i);
  let values = [];
  if (valuesAt >= 0) {
    const body = extractBody(sql.slice(valuesAt));
    if (body) values = splitTopLevel(body).map((s) => s.trim());
  }

  const fields = columns.map((name, i) => {
    const guess = values[i] !== undefined
      ? inferTypeFromValue(values[i], dialect)
      : { type: mapType("VARCHAR", dialect), params: {} };
    const field = createField(dialect, guess.type || DB_TYPES[dialect][0].key, name);
    Object.assign(field.params, guess.params);
    return field;
  });
  return { table, fields };
}

// ── 코드·데이터에서 스키마 가져오기 ────────────────────────────
// 테이블의 모양이 DDL 로만 오지는 않는다. JPA 를 쓰면 엔티티 클래스가 곧 스키마이고,
// 받은 데이터가 JSON·CSV 뿐일 때도 있다. 그래서 아래 소스를 모두 컬럼 정의로 읽는다:
//   CREATE TABLE · INSERT · JPA 자바 엔티티 · Kotlin data class · TypeScript interface · JSON · CSV
//
// 완전한 파서가 아니다. 실무에서 그대로 붙여넣는 형태를 읽어내는 데 초점을 두고,
// 못 읽은 건 경고(warnings)로 알린다.

/** 따옴표 안을 건너뛴다 — 문자열에 든 괄호·세미콜론에 속지 않으려고 */
function skipString(text, i) {
  const quote = text[i];
  i++;
  while (i < text.length) {
    if (text[i] === "\\") { i += 2; continue; }
    if (text[i] === quote) return i + 1;
    i++;
  }
  return i;
}

/** // 와 슬래시별 주석을 지운다. 문자열 안의 것은 남긴다. */
function stripComments(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = end;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** from 이후 첫 open 부터 짝이 맞는 close 까지의 내용 */
function readBlock(text, from, open, close) {
  const start = text.indexOf(open, from);
  if (start < 0) return null;
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(text, i); continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return { body: text.slice(start + 1, i), start, end: i + 1 };
    }
    i++;
  }
  return { body: text.slice(start + 1), start, end: text.length };
}

/** 괄호·꺾쇠 안의 쉼표는 빼고 최상위 쉼표로만 나눈다 (제네릭 타입 때문) */
function splitParams(body) {
  const out = [];
  let buf = "";
  let round = 0;
  let angle = 0;
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === '"' || c === "'" || c === "`") {
      const end = skipString(body, i);
      buf += body.slice(i, end);
      i = end;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") round++;
    else if (c === ")" || c === "]" || c === "}") round--;
    else if (c === "<") angle++;
    else if (c === ">") angle = Math.max(0, angle - 1);
    else if (c === "," && round === 0 && angle === 0) { out.push(buf.trim()); buf = ""; i++; continue; }
    buf += c;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** 애너테이션을 떼어 { anns, decl } 로 나눈다. anns 는 이름 → 괄호 안 문자열. */
function stripAnnotations(stmt) {
  const anns = {};
  let decl = "";
  let i = 0;
  while (i < stmt.length) {
    if (stmt[i] !== "@") {
      if (stmt[i] === '"' || stmt[i] === "'") {
        const end = skipString(stmt, i);
        decl += stmt.slice(i, end);
        i = end;
        continue;
      }
      decl += stmt[i];
      i++;
      continue;
    }
    const m = /^@\s*([\w.]+)/.exec(stmt.slice(i));
    if (!m) { decl += stmt[i]; i++; continue; }
    const name = m[1].split(".").pop();
    let j = i + m[0].length;
    while (j < stmt.length && /\s/.test(stmt[j])) j++;
    let args = "";
    if (stmt[j] === "(") {
      const block = readBlock(stmt, j, "(", ")");
      args = block ? block.body : "";
      j = block ? block.end : j + 1;
    }
    anns[name] = args;
    decl += " ";
    i = j;
  }
  return { anns, decl };
}

const annText = (args, key) => {
  const m = new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`).exec(args || "");
  return m ? m[1] : null;
};
const annNumber = (args, key) => {
  const m = new RegExp(`\\b${key}\\s*=\\s*(\\d+)`).exec(args || "");
  return m ? Number(m[1]) : null;
};
const annIsFalse = (args, key) => new RegExp(`\\b${key}\\s*=\\s*false`, "i").test(args || "");

/** camelCase → snake_case (JPA 기본 이름 전략) */
function snakeCase(name) {
  return String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/** 클래스명 → 테이블명. Entity·Dto 같은 꼬리는 테이블 이름이 아니다. */
function tableFromClassName(name) {
  const stripped = String(name || "").replace(/(Entity|Entities|DTO|Dto|VO|Vo|Model|Record|Row|Table)$/, "");
  return snakeCase(stripped || name) || "sample";
}

/** 한 컬럼을 만든다. canonical 은 표준 타입명이고, 방언 타입으로는 mapType 이 옮긴다. */
function fieldFrom(dialect, canonical, name, opts = {}, warnings) {
  const mapped = mapType(canonical, dialect);
  if (!mapped && warnings) {
    warnings.push(`${name}: ${canonical} 을(를) 이 DB 의 타입으로 옮기지 못해 기본 타입으로 넣었습니다.`);
  }
  const field = createField(dialect, mapped || DB_TYPES[dialect][0].key, name);
  const p = opts.params || {};
  for (const key of ["length", "precision", "scale"]) {
    if (p[key] !== undefined && field.params[key] !== undefined) field.params[key] = p[key];
  }
  // NULL 을 허용하는 컬럼에는 값에도 NULL 을 조금 섞는다 — 그래야 NULL 처리를 시험할 수 있다
  field.nullPercent = opts.nullable ? 10 : 0;
  if (opts.note) field.note = opts.note;
  return field;
}

/** 문자열 길이에서 넉넉한 VARCHAR 길이를 잡는다 (다른 행이 더 길 수 있으므로) */
const roundLength = (len) => Math.min(4000, Math.max(20, Math.ceil((len * 2) / 10) * 10));

// ── JVM 계열 (JPA 엔티티) ──────────────────────────────────

const JAVA_TYPES = {
  String: "VARCHAR", char: "CHAR", Character: "CHAR",
  long: "BIGINT", Long: "BIGINT", BigInteger: "BIGINT",
  int: "INT", Integer: "INT",
  short: "SMALLINT", Short: "SMALLINT", byte: "SMALLINT", Byte: "SMALLINT",
  boolean: "BOOLEAN", Boolean: "BOOLEAN",
  double: "FLOAT", Double: "FLOAT", float: "FLOAT", Float: "FLOAT",
  BigDecimal: "DECIMAL",
  LocalDate: "DATE", LocalTime: "TIME",
  LocalDateTime: "DATETIME", Instant: "DATETIME", ZonedDateTime: "DATETIME",
  OffsetDateTime: "DATETIME", Date: "DATETIME", Timestamp: "DATETIME", Calendar: "DATETIME",
  UUID: "UUID",
  // Kotlin
  Int: "INT", Char: "CHAR", ByteArray: "TEXT",
};

const COLLECTION_TYPES = /^(List|Set|Collection|Iterable|Map|SortedSet|SortedMap|ArrayList|LinkedList|HashSet|LinkedHashSet|HashMap|LinkedHashMap|TreeSet|TreeMap|Array)\b/;
const JAVA_MODIFIERS = new Set([
  "public", "private", "protected", "static", "final", "transient",
  "volatile", "abstract", "synchronized", "native", "strictfp", "default",
]);
/** 컬럼이 아닌 필드를 표시하는 애너테이션 */
const NOT_A_COLUMN = ["Transient", "OneToMany", "ManyToMany", "ElementCollection", "Formula"];
/** 이쪽 테이블에 FK 컬럼이 생기는 관계 */
const OWNING_RELATION = ["ManyToOne", "OneToOne"];

/** JVM 필드 하나를 컬럼으로. 컬럼이 아니면 null. */
function jvmField(anns, rawName, rawType, dialect, warnings, { nullableByDefault }) {
  if (NOT_A_COLUMN.some((a) => anns[a] !== undefined)) return null;

  const type = String(rawType || "").replace(/\s+/g, "");
  const relation = OWNING_RELATION.find((a) => anns[a] !== undefined);
  if (relation) {
    // 연관관계의 주인 쪽에는 FK 컬럼이 생긴다. 조인 컬럼명은 @JoinColumn 이 없으면 JPA 기본 규칙.
    const name = annText(anns.JoinColumn, "name") || `${snakeCase(rawName)}_id`;
    const notNull = annIsFalse(anns[relation], "optional") || annIsFalse(anns.JoinColumn, "nullable");
    warnings.push(`${name}: 연관관계라 FK 컬럼으로 넣었습니다. 상대 테이블 PK 타입이 다르면 바꿔 주세요.`);
    return fieldFrom(dialect, "BIGINT", name, { nullable: !notNull }, warnings);
  }
  if (COLLECTION_TYPES.test(type)) return null;

  const optional = type.endsWith("?");
  const bare = type.replace(/\?+$/, "").replace(/<.*>$/, "").replace(/\[\]$/, "");
  const isArray = /\[\]$/.test(type.replace(/\?+$/, ""));

  let canonical;
  if (anns.Lob !== undefined) canonical = "TEXT";
  else if (isArray && /^(byte|Byte)$/.test(bare)) canonical = "TEXT";
  else if (anns.Enumerated !== undefined) canonical = /ORDINAL/i.test(anns.Enumerated) ? "INT" : "VARCHAR";
  else canonical = JAVA_TYPES[bare] || "VARCHAR"; // enum·값 타입 등 모르는 타입은 문자열로 본다

  const column = annText(anns.Column, "name") || snakeCase(rawName);
  const params = {};
  const length = annNumber(anns.Column, "length");
  if (length) params.length = length;
  const precision = annNumber(anns.Column, "precision");
  if (precision) params.precision = precision;
  const scale = annNumber(anns.Column, "scale");
  if (scale !== null) params.scale = scale;

  // 기본형(long·int·boolean…)은 값에 null 이 올 수 없다
  const primitive = /^(long|int|short|byte|boolean|double|float|char)$/.test(bare);
  const notNull = anns.Id !== undefined
    || annIsFalse(anns.Column, "nullable")
    || (primitive && !optional);
  const nullable = notNull ? false : (optional || nullableByDefault);

  return fieldFrom(dialect, canonical, column, { params, nullable }, warnings);
}

/** 클래스 본문에서 최상위 문장(= 필드 선언)만 뽑는다. 메서드 본문 안은 건너뛴다. */
function javaStatements(body) {
  const out = [];
  let buf = "";
  let brace = 0;
  let paren = 0;
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === '"' || c === "'") {
      const end = skipString(body, i);
      if (brace === 0) buf += body.slice(i, end);
      i = end;
      continue;
    }
    if (c === "(") { paren++; if (brace === 0) buf += c; i++; continue; }
    if (c === ")") { paren = Math.max(0, paren - 1); if (brace === 0) buf += c; i++; continue; }
    if (paren === 0) {
      // 최상위 중괄호는 메서드·초기화 블록이다 — 앞에 모아 둔 시그니처째로 버린다
      if (c === "{") { if (brace === 0) buf = ""; brace++; i++; continue; }
      if (c === "}") { brace = Math.max(0, brace - 1); i++; continue; }
      if (brace === 0 && c === ";") {
        if (buf.trim()) out.push(buf.trim());
        buf = "";
        i++;
        continue;
      }
    }
    if (brace === 0) buf += c;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function parseJavaClass(text, dialect, warnings) {
  const code = stripComments(text);
  const nameMatch = /\bclass\s+(\w+)/.exec(code);
  const className = nameMatch ? nameMatch[1] : "sample";
  const header = code.slice(0, nameMatch ? nameMatch.index : 0);
  const table = annText(stripAnnotations(header).anns.Table, "name") || tableFromClassName(className);

  const block = readBlock(code, nameMatch ? nameMatch.index : 0, "{", "}");
  const fields = [];
  for (const stmt of javaStatements(block ? block.body : "")) {
    const { anns, decl } = stripAnnotations(stmt);
    const cleaned = decl.replace(/=[\s\S]*$/, "").trim();
    if (/\bstatic\b|\btransient\b/.test(cleaned)) continue; // 영속 대상이 아니다
    const words = cleaned.split(/\s+/).filter((w) => w && !JAVA_MODIFIERS.has(w));
    if (words.length < 2) continue;

    const rawName = words[words.length - 1].replace(/\[\s*\]$/, "");
    if (!/^[A-Za-z_]\w*$/.test(rawName)) continue;
    const rawType = words.slice(0, -1).join(" ");

    const field = jvmField(anns, rawName, rawType, dialect, warnings, { nullableByDefault: true });
    if (field) fields.push(field);
  }
  return { table, fields };
}

function parseKotlinClass(text, dialect, warnings) {
  const code = stripComments(text);
  const nameMatch = /\bclass\s+(\w+)/.exec(code);
  const className = nameMatch ? nameMatch[1] : "sample";
  const header = code.slice(0, nameMatch ? nameMatch.index : 0);
  const table = annText(stripAnnotations(header).anns.Table, "name") || tableFromClassName(className);

  const after = code.slice(nameMatch ? nameMatch.index + nameMatch[0].length : 0);
  const fields = [];
  const seen = new Set();

  const add = (anns, name, type) => {
    const field = jvmField(anns, name, type, dialect, warnings, { nullableByDefault: false });
    if (field && !seen.has(field.name)) { seen.add(field.name); fields.push(field); }
  };

  // 주 생성자 프로퍼티 — 클래스 본문보다 먼저 오는 괄호
  const braceAt = after.indexOf("{");
  const parenAt = after.indexOf("(");
  if (parenAt >= 0 && (braceAt < 0 || parenAt < braceAt)) {
    const ctor = readBlock(after, parenAt, "(", ")");
    for (const param of splitParams(ctor ? ctor.body : "")) {
      const { anns, decl } = stripAnnotations(param);
      const m = /\b(?:val|var)\s+(\w+)\s*:\s*([^=]+)/.exec(decl);
      if (m) add(anns, m[1], m[2]);
    }
  }

  // 본문 프로퍼티 — 함수 안의 지역 val 을 집지 않도록 최상위 줄만 본다
  const body = readBlock(after, 0, "{", "}");
  if (body) {
    let depth = 0;
    for (const line of body.body.split("\n")) {
      const trimmed = line.trim();
      if (depth === 0) {
        const m = /^((?:@[\w.]+(?:\([^)]*\))?\s*)*)(?:private\s+|internal\s+|protected\s+|public\s+|lateinit\s+|open\s+|override\s+)*(?:val|var)\s+(\w+)\s*:\s*([^=]+)/.exec(trimmed);
        if (m) {
          const { anns } = stripAnnotations(m[1]);
          add(anns, m[2], m[3]);
        }
      }
      depth += (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
      depth = Math.max(0, depth);
    }
  }
  return { table, fields };
}

// ── TypeScript interface / type ────────────────────────────

const TS_TYPES = {
  string: "VARCHAR", number: "INT", bigint: "BIGINT", boolean: "BOOLEAN",
  Date: "DATETIME", any: "VARCHAR", unknown: "VARCHAR", object: "JSON",
};

function parseTsInterface(text, dialect, warnings) {
  const code = stripComments(text);
  const nameMatch = /\b(?:interface|type)\s+(\w+)/.exec(code);
  const table = tableFromClassName(nameMatch ? nameMatch[1] : "sample");

  const block = readBlock(code, nameMatch ? nameMatch.index : 0, "{", "}");
  const fields = [];
  if (!block) return { table, fields };

  // 멤버는 ; 나 줄바꿈으로 끊긴다. 중첩 객체·유니온은 splitParams 가 지켜 준다.
  for (const raw of splitParams(block.body.replace(/;/g, ","))) {
    const member = raw.trim();
    const m = /^(?:readonly\s+)?["'`]?([\w$]+)["'`]?\s*(\?)?\s*:\s*([\s\S]+)$/.exec(member);
    if (!m) continue;

    const name = m[1];
    let nullable = Boolean(m[2]);
    const parts = m[3].split("|").map((s) => s.trim()).filter(Boolean);
    const useful = parts.filter((p) => !/^(null|undefined)$/.test(p));
    if (useful.length !== parts.length) nullable = true;
    const type = (useful[0] || "string").replace(/["'`]/g, "");

    let canonical;
    if (/\[\]$/.test(type) || /^(Array|ReadonlyArray|Record|Map)\s*</.test(type) || type.startsWith("{")) {
      canonical = "JSON";
    } else if (useful.length > 1 && useful.every((p) => /^["'`]/.test(p.trim()))) {
      canonical = "VARCHAR"; // 'A' | 'B' 같은 리터럴 유니온
    } else {
      canonical = TS_TYPES[type] || "VARCHAR";
    }
    // TS·JSON 의 키는 JPA 처럼 자동 변환되는 이름이 아니다 — 쓰인 그대로 둔다
    fields.push(fieldFrom(dialect, canonical, name, { nullable }, warnings));
  }
  return { table, fields };
}

// ── JSON · CSV (값에서 타입을 추론) ────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** JS 값 하나에서 컬럼 타입을 추론한다. 모르면 null(= 아직 판단 보류). */
function typeFromValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return { canonical: "BOOLEAN", params: {} };
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return { canonical: Math.abs(value) > 2147483647 ? "BIGINT" : "INT", params: {} };
    }
    const scale = (String(value).split(".")[1] || "").length || 2;
    return { canonical: "DECIMAL", params: { precision: 12, scale } };
  }
  if (typeof value === "object") return { canonical: "JSON", params: {} };

  const s = String(value);
  if (s.trim() === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { canonical: "DATE", params: {} };
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) return { canonical: "DATETIME", params: {} };
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return { canonical: "TIME", params: {} };
  if (UUID_RE.test(s)) return { canonical: "UUID", params: { length: 36 } };
  return { canonical: "VARCHAR", params: { length: roundLength(s.length) } };
}

/** 여러 행을 훑어 컬럼별 타입을 정한다 — 첫 행이 null 이어도 다음 행에서 채운다 */
function fieldsFromRecords(records, dialect, warnings) {
  const order = [];
  const guess = new Map();
  const nullable = new Set();

  for (const record of records) {
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    for (const [key, value] of Object.entries(record)) {
      if (!order.includes(key)) order.push(key);
      const t = typeFromValue(value);
      if (!t) { nullable.add(key); continue; }
      const prev = guess.get(key);
      if (!prev) guess.set(key, t);
      else if (prev.canonical === "VARCHAR" && t.canonical === "VARCHAR") {
        prev.params.length = Math.max(prev.params.length || 0, t.params.length || 0);
      }
    }
  }

  return order.map((key) => {
    const t = guess.get(key) || { canonical: "VARCHAR", params: {} };
    return fieldFrom(dialect, t.canonical, key, { params: t.params, nullable: nullable.has(key) }, warnings);
  });
}

function parseJsonRecords(text, dialect, warnings) {
  const value = JSON.parse(text);
  const records = Array.isArray(value) ? value : [value];
  return { table: "sample", fields: fieldsFromRecords(records, dialect, warnings) };
}

const CSV_DELIMITERS = [",", "\t", ";", "|"];

/** 헤더 줄에서 가장 많이 쓰인 구분자를 고른다 */
function csvDelimiter(line) {
  let best = null;
  let bestCount = 0;
  for (const d of CSV_DELIMITERS) {
    const count = splitCsvLine(line, d).length - 1;
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

function splitCsvLine(line, delimiter) {
  const out = [];
  let buf = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { buf += '"'; i++; continue; }
      if (c === '"') { quoted = false; continue; }
      buf += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === delimiter) { out.push(buf); buf = ""; continue; }
    buf += c;
  }
  out.push(buf);
  return out;
}

// 엑셀이 붙인 BOM 은 첫 컬럼명에 들어가 버리므로 먼저 뗀다
const csvLines = (text) => text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter((l) => l.trim() !== "");

/** CSV 로 오해하기 쉬운 다른 SQL 문장 — 세미콜론이 구분자로 보이기 때문에 먼저 걸러낸다 */
const OTHER_SQL = /^\s*(SELECT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|MERGE|WITH|GRANT|COMMENT)\b/i;

/** 헤더와 데이터 행의 칸 수가 맞는 표 모양인가 */
function looksLikeCsv(text) {
  if (OTHER_SQL.test(text)) return false;
  const lines = csvLines(text);
  if (!lines.length) return false;
  const delimiter = csvDelimiter(lines[0]);
  if (!delimiter) return false;

  const header = splitCsvLine(lines[0], delimiter);
  if (header.length < 2) return false;
  // 빈 헤더 칸이 있으면 표가 아니다. 이게 없으면 "a;" 같은 문장 한 줄도 2칸짜리 CSV 로 읽힌다.
  if (header.some((cell) => cell.trim() === "")) return false;
  return lines.every((line) => splitCsvLine(line, delimiter).length === header.length);
}

/** CSV 칸 문자열을 JS 값처럼 본다 — 타입 추론을 JSON 과 한 곳에서 하려고 */
function coerceCell(raw) {
  const s = String(raw).trim();
  if (s === "" || /^(null|NULL)$/.test(s)) return null;
  if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
  if (/^-?\d+$/.test(s) && s.length <= 15) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  return s;
}

function parseCsvTable(text, dialect, warnings) {
  const lines = csvLines(text);
  const delimiter = csvDelimiter(lines[0]) || ",";
  const header = splitCsvLine(lines[0], delimiter).map((h) => h.trim()).filter((h) => h !== "");

  const records = lines.slice(1, 21).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    return Object.fromEntries(header.map((name, i) => [name, coerceCell(cells[i] ?? "")]));
  });

  // 헤더만 붙여넣었으면 타입 근거가 없다 — 전부 문자열로 두고 사용자가 고치게 한다
  if (!records.length) {
    return { table: "sample", fields: header.map((name) => fieldFrom(dialect, "VARCHAR", name, {}, warnings)) };
  }
  return { table: "sample", fields: fieldsFromRecords(records, dialect, warnings) };
}

// ── 어떤 소스인지 알아보기 ─────────────────────────────────

/** 붙여넣은 게 무엇인지 판별한다. 모르면 null. */
function detectSource(text) {
  const trimmed = text.trim();
  if (/CREATE\s+(?:OR\s+REPLACE\s+)?(?:GLOBAL\s+TEMPORARY\s+|TEMP(?:ORARY)?\s+)?TABLE/i.test(trimmed)) return "sql";
  if (/INSERT\s+INTO/i.test(trimmed)) return "sql";

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const value = JSON.parse(trimmed);
      if (value && typeof value === "object") return "json";
    } catch { /* JSON 이 아니면 아래에서 계속 본다 */ }
  }

  const code = stripComments(trimmed);
  if (/\bdata\s+class\s+\w+/.test(code)) return "kotlin";
  if (/\b(?:interface|type)\s+\w+\s*[={]/.test(code) && /[\w$]+\s*\??\s*:/.test(code)) return "ts";
  if (/\bclass\s+\w+/.test(code)) return /\b(?:val|var)\s+\w+\s*:/.test(code) ? "kotlin" : "java";

  if (looksLikeCsv(trimmed)) return "csv";
  return null;
}

const SOURCE_LABELS = {
  sql: "SQL", java: "자바 클래스", kotlin: "코틀린 클래스",
  ts: "TypeScript 타입", json: "JSON", csv: "CSV",
};

/**
 * 붙여넣은 내용에서 컬럼 정의를 만든다.
 *
 * <p>읽는 소스: CREATE TABLE · INSERT · JPA 자바 엔티티 · Kotlin data class ·
 * TypeScript interface · JSON · CSV. 무엇인지는 내용을 보고 알아낸다.
 *
 * @param {string} input 붙여넣은 텍스트
 * @param {string} [forceDialect] 지정하면 그 방언의 타입으로 옮긴다. 없으면 SQL 에서 추측.
 */
export function parseSchema(input, forceDialect) {
  const text = String(input || "");
  if (!text.trim()) return { ok: false, reason: "붙여넣은 내용이 없습니다." };

  const source = detectSource(text);
  if (!source) {
    return {
      ok: false,
      reason: "읽을 수 있는 형식이 아닙니다 — CREATE TABLE·INSERT, JPA 엔티티(Java·Kotlin), "
        + "TypeScript interface, JSON, CSV 중 하나를 붙여넣어 주세요.",
    };
  }

  // 방언은 사용자가 고른 것이 우선이다. SQL 일 때만 문법으로 추측한다.
  const dialect = forceDialect && DB_TYPES[forceDialect]
    ? forceDialect
    : (source === "sql" ? detectDialect(text) : "mysql");
  const warnings = [];

  try {
    let parsed;
    if (source === "sql") {
      const isCreate = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:GLOBAL\s+TEMPORARY\s+|TEMP(?:ORARY)?\s+)?TABLE/i.test(text);
      parsed = isCreate ? parseCreateTable(text, dialect, warnings) : parseInsert(text, dialect);
      if (isCreate) applyColumnComments(text, parsed.fields);
    } else if (source === "java") {
      parsed = parseJavaClass(text, dialect, warnings);
    } else if (source === "kotlin") {
      parsed = parseKotlinClass(text, dialect, warnings);
    } else if (source === "ts") {
      parsed = parseTsInterface(text, dialect, warnings);
    } else if (source === "json") {
      parsed = parseJsonRecords(text, dialect, warnings);
    } else {
      parsed = parseCsvTable(text, dialect, warnings);
    }

    if (!parsed.fields.length) {
      return {
        ok: false,
        reason: `${SOURCE_LABELS[source]} 로 읽었지만 컬럼을 하나도 찾지 못했습니다. 정의 부분을 함께 붙여넣었는지 확인해 주세요.`,
      };
    }
    return { ok: true, source, dialect, table: parsed.table, fields: parsed.fields, warnings };
  } catch (e) {
    return { ok: false, reason: `읽는 중 문제가 생겼습니다: ${e.message}` };
  }
}
