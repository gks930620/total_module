// 데이터 형식 변환 — 전부 클라이언트(NFR-02).
//
// JSON·YAML·CSV·TSV·마크다운 표를 **읽어들여** 그 중 아무 형식으로나 **내보낸다.**
// SQL INSERT 와 타입 코드(TypeScript·Java·Kotlin)는 내보내기 전용이다.
//
// 설계: 입력을 한 번 **JS 값**으로 눕힌 뒤(canonical) 원하는 형식으로 직렬화한다.
//   입력 → parse → JS 값 → serialize → 출력
// 이렇게 두면 조합이 N×M 이 아니라 N+M 으로 끝나고, 새 형식은 한쪽만 채우면 된다.

import { toYaml, fromYaml } from "./yaml.js";
import {
  parseCsv, toCsv as tableToCsv, toJsonRows, fromJsonRows,
  toMarkdownTable, parseMarkdownTable, toInsertSql,
} from "./csvTool.js";
import { jsonToTypes } from "./codegen.js";

export const INPUT_FORMATS = [
  { key: "json", label: "JSON" },
  { key: "yaml", label: "YAML" },
  { key: "csv", label: "CSV (쉼표)" },
  { key: "tsv", label: "TSV (탭)" },
  { key: "markdown", label: "마크다운 표" },
];

export const OUTPUT_FORMATS = [
  { key: "json", label: "JSON" },
  { key: "yaml", label: "YAML" },
  { key: "csv", label: "CSV (쉼표)", needsTable: true },
  { key: "tsv", label: "TSV (탭)", needsTable: true },
  { key: "markdown", label: "마크다운 표", needsTable: true },
  { key: "sql", label: "SQL INSERT", needsTable: true },
  { key: "ts", label: "TypeScript interface" },
  { key: "java", label: "Java class (Lombok)" },
  { key: "record", label: "Java record" },
  { key: "kotlin", label: "Kotlin data class" },
];

/**
 * 화면이 내보내는 JSON 의 들여쓰기 칸 수.
 *
 * <p>고를 수 있게 뒀더니 셀렉트 하나가 도구 막대를 차지했다. 값을 정해 두면
 * 화면이 단순해지고, 정말 다른 폭이 필요하면 저장한 파일을 편집기가 다시 맞춘다.
 * (라이브러리는 여전히 아무 값이나 받는다 — options.indent)
 */
export const INDENT = 3;

const TYPE_LANGS = { ts: "ts", java: "java", record: "record", kotlin: "kotlin" };

/** 붙여넣은 내용을 보고 형식을 짐작한다 — 사용자가 매번 고르지 않아도 되게 */
export function detectFormat(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;

  if (/^[[{]/.test(s)) return "json";

  const lines = s.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length >= 2 && lines[0].trim().startsWith("|") && /^\s*\|[\s|:-]+\|?\s*$/.test(lines[1])) {
    return "markdown";
  }

  // 표는 첫 줄과 둘째 줄의 칸 수가 같아야 한다 — YAML 의 "a: 1" 을 CSV 로 오인하지 않도록
  const sameCount = (sep) => {
    if (lines.length < 2) return false;
    const n = lines[0].split(sep).length;
    return n > 1 && lines.slice(0, 5).every((l) => l.split(sep).length === n);
  };
  if (sameCount("\t")) return "tsv";
  if (sameCount(",")) return "csv";

  if (/^\s*[\w가-힣."'-]+\s*:\s/m.test(s) || /^\s*-\s+/m.test(s)) return "yaml";
  return null;
}

// ── 입력 → JS 값 ───────────────────────────────────────────
/**
 * 텍스트 → JS 값. 데이터 뷰어(lib/dataView.js)도 이걸 쓴다 —
 * 파서를 두 벌 두면 형식이 늘 때마다 두 곳을 고쳐야 한다.
 */
export function parseInput(text, format, options) {
  const s = String(text ?? "").trim();
  if (!s) return { ok: false, reason: "변환할 내용을 입력해 주세요." };

  switch (format) {
    case "json":
      try {
        return { ok: true, value: JSON.parse(s) };
      } catch (e) {
        return { ok: false, reason: `JSON 을 읽지 못했습니다: ${e.message}` };
      }

    case "yaml": {
      // fromYaml 은 값을 그대로 돌려주고 형식 오류 시 예외를 던진다
      try {
        const value = fromYaml(s);
        if (value === null || value === undefined) {
          return { ok: false, reason: "읽어낼 내용이 없습니다." };
        }
        return { ok: true, value };
      } catch (e) {
        return { ok: false, reason: `YAML 을 읽지 못했습니다: ${e.message}` };
      }
    }

    case "csv":
    case "tsv": {
      const r = parseCsv(s, {
        delimiter: format === "tsv" ? "\t" : options.delimiter,
        hasHeader: options.hasHeader !== false,
      });
      if (!r.ok) return { ok: false, reason: r.reason };
      return { ok: true, value: toJsonRows(r), table: r };
    }

    case "markdown": {
      const r = parseMarkdownTable(s);
      if (!r.ok) return { ok: false, reason: r.reason };
      return { ok: true, value: toJsonRows(r), table: r };
    }

    default:
      return { ok: false, reason: `읽을 수 없는 형식입니다: ${format}` };
  }
}

/**
 * JS 값을 { header, rows } 표로 눕힌다.
 * 객체 하나는 한 행짜리 표로 본다. 중첩 값은 JSON 문자열로 담는다(csvTool 의 규칙).
 */
function toTable(value) {
  if (Array.isArray(value)) {
    if (!value.length) return { ok: true, header: [], rows: [] };
    if (value.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
      return fromJsonRows(value);
    }
    // 원시값 배열은 한 열짜리 표로 본다
    if (value.every((v) => v === null || typeof v !== "object")) {
      return { ok: true, header: ["value"], rows: value.map((v) => [v === null ? "" : String(v)]) };
    }
    return { ok: false, reason: "배열 안의 모양이 제각각이라 표로 만들 수 없습니다." };
  }
  if (value && typeof value === "object") return fromJsonRows([value]);
  return { ok: false, reason: "표로 만들려면 객체나 객체 배열이어야 합니다. 지금은 값 하나뿐입니다." };
}

/**
 * 표에서 "중첩이라 JSON 문자열로 눌러 담은" 열 이름을 찾는다.
 *
 * <p>표의 한 칸에는 값 하나만 들어간다. 그래서 객체·배열은 JSON 문자열로 담는데,
 * 이건 손실이 아니라(되돌리면 원본이 나온다) **말 없이 일어나면 안 되는 일**이다.
 * JSON 컬럼에 넣을 거면 그게 정답이고, 아니면 사용자가 알고 손을 봐야 한다.
 */
function nestedColumns(table) {
  if (!table?.raw?.length) return [];
  return table.header.filter((_, j) =>
    table.raw.some((row) => row[j] !== null && typeof row[j] === "object")
  );
}

// ── JS 값 → 출력 ───────────────────────────────────────────
function serialize(value, format, options, sourceTable) {
  switch (format) {
    case "json": {
      const indent = Number.isFinite(Number(options.indent)) ? Number(options.indent) : 2;
      return { ok: true, text: JSON.stringify(value, null, indent) };
    }

    case "yaml":
      return { ok: true, text: toYaml(value) };

    case "csv":
    case "tsv":
    case "markdown":
    case "sql": {
      // 입력이 이미 표였으면 그 표를 그대로 쓴다(열 순서·빈 칸이 보존된다)
      const table = sourceTable || toTable(value);
      if (!table.ok) return { ok: false, reason: table.reason };

      const nested = nestedColumns(table);
      const notes = nested.length
        ? [`${nested.join(", ")} 은(는) 중첩 구조라 JSON 문자열로 담았습니다. JSON 컬럼이 아니면 손봐야 합니다.`]
        : [];

      if (format === "markdown") {
        return { ok: true, notes, text: toMarkdownTable(table, { align: options.align || "left" }) };
      }
      if (format === "sql") {
        return {
          ok: true,
          notes,
          text: toInsertSql(table, options.table || "sample", { dialect: options.dialect || "mysql" }),
        };
      }
      return {
        ok: true,
        notes,
        text: tableToCsv(table, { delimiter: format === "tsv" ? "\t" : options.delimiter || "," }),
      };
    }

    case "ts":
    case "java":
    case "record":
    case "kotlin": {
      const r = jsonToTypes(JSON.stringify(value), {
        lang: TYPE_LANGS[format],
        rootName: options.rootName || "Root",
      });
      if (!r.ok) return { ok: false, reason: r.reason || "타입 코드를 만들지 못했습니다." };
      return { ok: true, text: r.code, typeCount: r.typeCount };
    }

    default:
      return { ok: false, reason: `내보낼 수 없는 형식입니다: ${format}` };
  }
}

/**
 * 한 형식에서 다른 형식으로 변환한다.
 * @param {string} text 원본
 * @param {string} from 입력 형식 (INPUT_FORMATS)
 * @param {string} to 출력 형식 (OUTPUT_FORMATS)
 * @param {object} [options] indent · delimiter · hasHeader · table · rootName · align
 */
export function convert(text, from, to, options = {}) {
  if (!INPUT_FORMATS.some((f) => f.key === from)) {
    return { ok: false, reason: `읽을 수 없는 형식입니다: ${from}` };
  }
  if (!OUTPUT_FORMATS.some((f) => f.key === to)) {
    return { ok: false, reason: `내보낼 수 없는 형식입니다: ${to}` };
  }

  try {
    const parsed = parseInput(text, from, options);
    if (!parsed.ok) return parsed;

    // 표 → 표 변환은 중간에 JS 값을 거치지 않고 원본 표를 넘긴다(열 순서 보존)
    const tableIn = parsed.table && ["csv", "tsv", "markdown", "sql"].includes(to) ? parsed.table : null;
    return serialize(parsed.value, to, options, tableIn);
  } catch (e) {
    return { ok: false, reason: `변환 중 문제가 생겼습니다: ${e.message}` };
  }
}
