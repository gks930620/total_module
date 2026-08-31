import { dialectOf, sqlValue, coerceCell } from "./sqlDialect.js";

// CSV ↔ JSON ↔ 마크다운 표 상호 변환 — 전부 클라이언트(NFR-02).
// RFC 4180 을 따르되 실무에서 흔한 변형(탭 구분·BOM·CRLF)을 받아준다.

/** 구분자 후보 중 가장 그럴듯한 것을 고른다(행마다 개수가 일정한 것). */
export function detectDelimiter(text) {
  const sample = String(text ?? "").replace(/\r\n?/g, "\n").split("\n").filter(Boolean).slice(0, 20);
  if (!sample.length) return ",";
  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestScore = -1;
  for (const d of candidates) {
    const counts = sample.map((line) => splitRow(line, d).length);
    const first = counts[0];
    if (first <= 1) continue;
    const consistent = counts.filter((c) => c === first).length / counts.length;
    const score = consistent * 10 + first; // 일관성 우선, 그다음 열 수
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/** 따옴표를 존중하며 한 줄을 쪼갠다 */
/**
 * 한 줄을 칸으로 나눈다.
 *
 * <p>다듬기(trim)를 여기서 정하는 이유 — RFC 4180 에서 **따옴표 안은 값 그대로**다.
 * {@code "  x  "} 의 공백은 데이터고, 따옴표 없는 {@code   x  } 의 공백은 사람이
 * 보기 좋으라고 넣은 것이다(손으로 쓴 {@code a, b, c} 를 받아 주려면 다듬어야 한다).
 * 밖에서 일괄로 trim 하면 이 둘을 구분할 수 없어 데이터가 조용히 바뀐다.
 */
function splitRow(line, delimiter) {
  const out = [];
  let cur = "";
  let inQuote = false;
  let quoted = false;
  const push = () => {
    out.push(quoted ? cur : cur.trim());
    cur = "";
    quoted = false;
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else if (c === '"') {
      inQuote = true;
      quoted = true;
    } else if (c === delimiter) {
      push();
    } else cur += c;
  }
  push();
  return out;
}

/** CSV 텍스트 → { header[], rows[][] }. 따옴표 안의 개행도 처리한다. */
export function parseCsv(text, { delimiter, hasHeader = true } = {}) {
  let s = String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"); // BOM 제거
  if (!s.trim()) return { ok: false, reason: "내용이 비어 있습니다." };
  const d = delimiter || detectDelimiter(s);

  // 따옴표 안의 개행을 임시 치환해 줄 분리를 안전하게 한다
  const NL = "\u0000NL\u0000";
  let inQuote = false;
  let buf = "";
  for (const c of s) {
    if (c === '"') inQuote = !inQuote;
    buf += c === "\n" && inQuote ? NL : c;
  }
  const lines = buf.split("\n").filter((l) => l.trim() !== "");
  const table = lines.map((l) => splitRow(l.split(NL).join("\n"), d));

  const width = Math.max(...table.map((r) => r.length));
  const padded = table.map((r) => [...r, ...Array(width - r.length).fill("")]);

  const header = hasHeader ? padded[0] : padded[0].map((_, i) => `col${i + 1}`);
  const rows = hasHeader ? padded.slice(1) : padded;
  return { ok: true, delimiter: d, header, rows, columnCount: width, rowCount: rows.length };
}

const csvCell = (v, d) => {
  const s = String(v ?? "");
  // 앞뒤 공백도 감싼다 — 안 감싸면 읽는 쪽이 "보기 좋으라고 넣은 공백" 으로 보고 지운다
  const needsQuoting = new RegExp(`["\\n${d === "|" ? "\\|" : d}]`).test(s) || /^\s|\s$/.test(s);
  return needsQuoting ? `"${s.replace(/"/g, '""')}"` : s;
};

/** { header, rows } → CSV */
export function toCsv({ header, rows }, { delimiter = "," } = {}) {
  const lines = [header.map((h) => csvCell(h, delimiter)).join(delimiter)];
  for (const r of rows) lines.push(r.map((c) => csvCell(c, delimiter)).join(delimiter));
  return lines.join("\n");
}

/** { header, rows } → JSON 객체 배열 */
export function toJsonRows({ header, rows }, { typed = true } = {}) {
  return rows.map((r) => {
    const o = {};
    header.forEach((h, i) => {
      const raw = r[i] ?? "";
      o[h || `col${i + 1}`] = typed ? castValue(raw) : raw;
    });
    return o;
  });
}

function castValue(raw) {
  // 다듬은 값은 **어떤 타입인지 판별하는 데만** 쓴다. 문자열로 남는 값은 원본을 돌려준다 —
  // 여기서 다듬은 걸 돌려주면 따옴표로 감싸 지켜 온 공백(RFC 4180)이 결국 지워진다.
  const s = String(raw).trim();
  if (s === "") return String(raw);
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
  if (/^null$/i.test(s)) return null;
  // 앞자리 0이 있는 값(사번·우편번호)은 문자열로 둔다
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isSafeInteger(n) || !Number.isInteger(n)) return n;
  }
  return String(raw);
}

/** JSON 객체 배열 → { header, rows } */
export function fromJsonRows(json) {
  let data;
  try {
    data = typeof json === "string" ? JSON.parse(json) : json;
  } catch (e) {
    return { ok: false, reason: `JSON 파싱 실패: ${e.message}` };
  }
  if (!Array.isArray(data)) return { ok: false, reason: "객체 배열(JSON array)이어야 합니다." };
  if (!data.length) return { ok: true, header: [], rows: [] };

  const header = [];
  for (const item of data) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      for (const k of Object.keys(item)) if (!header.includes(k)) header.push(k);
    }
  }
  // rows 는 보여 주기용 문자열, raw 는 원본 값이다.
  // 문자열만 남기면 타입이 사라져 SQL 출력에서 NULL 과 빈 문자열을 구분할 수 없다.
  const raw = data.map((item) => header.map((k) => item?.[k] ?? null));
  const rows = raw.map((row) =>
    row.map((v) => {
      if (v === null || v === undefined) return "";
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    })
  );
  return { ok: true, header, rows, raw };
}

/** { header, rows } → 마크다운 표 */
/**
 * 셀 하나를 마크다운 표에 넣을 수 있는 모양으로.
 *
 * <p>파이프를 그대로 흘리면 열이 하나 늘어나 표가 깨지고, 줄바꿈은 행을 쪼갠다.
 * 표에서는 한 줄이 한 행이므로 줄바꿈은 GFM 관례대로 {@code <br>} 로 바꾼다.
 */
const mdCell = (c) => String(c ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

export function toMarkdownTable(table, { align = "left" } = {}) {
  if (!table.header.length) return "";
  const header = table.header.map(mdCell);
  const rows = table.rows.map((r) => r.map(mdCell));
  // 너비는 이스케이프한 뒤 글자로 재야 칸이 맞는다
  const widths = header.map((h, i) =>
    Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r[i] ?? "")))
  );
  const sepFor = (w) => (align === "center" ? `:${"-".repeat(Math.max(w, 3) - 2)}:` : align === "right" ? `${"-".repeat(Math.max(w, 3) - 1)}:` : "-".repeat(Math.max(w, 3)));
  const line = (cells) => `| ${cells.map((c, i) => pad(String(c ?? ""), widths[i])).join(" | ")} |`;
  return [
    line(header),
    `| ${widths.map(sepFor).join(" | ")} |`,
    ...rows.map((r) => line(r)),
  ].join("\n");
}

// 한글은 폭이 2라 마크다운 원문 정렬이 어긋난다 — 표시 폭 기준으로 맞춘다
function displayWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return w;
}
function pad(s, width) {
  return s + " ".repeat(Math.max(0, width - displayWidth(s)));
}

/** 마크다운 표 → { header, rows } */
export function parseMarkdownTable(text) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n")
    .map((l) => l.trim()).filter((l) => l.startsWith("|"));
  if (lines.length < 2) return { ok: false, reason: "마크다운 표 형식이 아닙니다(| 로 시작하는 줄이 2줄 이상 필요)." };

  // 이스케이프한 파이프(\\|)는 칸 구분자가 아니다. <br> 는 넣을 때 바꾼 줄바꿈이라 되돌린다.
  const cells = (l) =>
    l.replace(/^\|/, "").replace(/(?<!\\)\|$/, "")
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, "|").replace(/<br\s*\/?>/gi, "\n"));
  const header = cells(lines[0]);
  const isSep = /^[\s|:-]+$/.test(lines[1]);
  const rows = lines.slice(isSep ? 2 : 1).map(cells);
  return { ok: true, header, rows };
}

export const CSV_FORMATS = [
  { key: "csv", label: "CSV (쉼표)" },
  { key: "tsv", label: "TSV (탭)" },
  { key: "json", label: "JSON" },
  { key: "markdown", label: "마크다운 표" },
  { key: "sql", label: "SQL INSERT" },
];

/** { header, rows } → SQL INSERT */
/**
 * 표를 INSERT 문으로.
 *
 * <p>표의 셀은 두 가지다 — JSON·YAML 에서 온 표는 {@code raw} 에 원본 값(숫자·불리언·
 * null·중첩 객체)을 들고 있고, CSV·마크다운에서 온 표는 문자열뿐이다.
 * 앞은 그대로 쓰고, 뒤는 {@link coerceCell} 로 타입을 되살린다. 그래야
 * {@code NULL} 이 빈 문자열이 되거나 숫자에 따옴표가 붙는 일이 없다.
 *
 * <p>식별자는 방언 규칙대로 감싼다. 안 감싸면 예약어(order)에서 문법 오류가 나고,
 * PostgreSQL 에서는 대문자 컬럼명이 소문자로 접혀 "없는 컬럼" 이 된다.
 */
export function toInsertSql({ header, rows, raw }, table = "sample", { dialect = "mysql" } = {}) {
  if (!header.length) return "";
  const d = dialectOf(dialect);
  const cols = header.map((h) => d.quote(h)).join(", ");

  return rows
    .map((row, i) => {
      const values = row.map((cell, j) => {
        const value = raw ? raw[i]?.[j] : coerceCell(cell);
        return sqlValue(value, d);
      });
      return `INSERT INTO ${d.quote(table)} (${cols}) VALUES (${values.join(", ")});`;
    })
    .join("\n");
}
