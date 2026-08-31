// 문자열 케이스 변환 — 전부 클라이언트(NFR-02).
// 스택 간 네이밍 변환(Java camelCase ↔ DB snake_case ↔ URL kebab-case)에 쓴다.

/**
 * 식별자를 단어 배열로 분해한다(전부 소문자).
 * 약어 처리가 핵심: "XMLHttpRequest" → [xml, http, request]
 * (연속 대문자 뒤에 대문자+소문자가 오면 마지막 대문자부터 새 단어)
 */
export function splitWords(input) {
  const s = String(input ?? "");
  if (!s.trim()) return [];

  return s
    // 구분자를 공백으로
    .replace(/[_\-.\s/\\]+/g, " ")
    // 소문자/숫자 다음 대문자 → 경계
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    // 연속 대문자 다음 대문자+소문자 → 경계 (XMLHttp → XML Http)
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    // 글자와 숫자 사이 경계
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

const CONVERTERS = {
  camel: (w) => w.map((x, i) => (i === 0 ? x : cap(x))).join(""),
  pascal: (w) => w.map(cap).join(""),
  snake: (w) => w.join("_"),
  constant: (w) => w.join("_").toUpperCase(),
  kebab: (w) => w.join("-"),
  train: (w) => w.map(cap).join("-"),
  dot: (w) => w.join("."),
  path: (w) => w.join("/"),
  lower: (w) => w.join(" "),
  upper: (w) => w.join(" ").toUpperCase(),
  title: (w) => w.map(cap).join(" "),
  sentence: (w) => (w.length ? cap(w[0]) + (w.length > 1 ? " " + w.slice(1).join(" ") : "") : ""),
};

export const CASE_STYLES = [
  { key: "camel", label: "camelCase", hint: "JS/Java 변수·메서드" },
  { key: "pascal", label: "PascalCase", hint: "클래스·컴포넌트명" },
  { key: "snake", label: "snake_case", hint: "DB 컬럼·Python" },
  { key: "constant", label: "CONSTANT_CASE", hint: "상수·환경변수" },
  { key: "kebab", label: "kebab-case", hint: "URL·CSS 클래스" },
  { key: "train", label: "Train-Case", hint: "HTTP 헤더" },
  { key: "dot", label: "dot.case", hint: "설정 키(yml/properties)" },
  { key: "path", label: "path/case", hint: "경로" },
  { key: "lower", label: "lower case", hint: "공백 구분 소문자" },
  { key: "upper", label: "UPPER CASE", hint: "공백 구분 대문자" },
  { key: "title", label: "Title Case", hint: "제목" },
  { key: "sentence", label: "Sentence case", hint: "문장" },
];

/** 한 스타일로 변환. 여러 줄이면 줄 단위로 각각 변환한다. */
export function convertCase(input, style) {
  const fn = CONVERTERS[style];
  if (!fn) return "";
  return String(input ?? "")
    .split("\n")
    .map((line) => fn(splitWords(line)))
    .join("\n");
}

/** 모든 스타일을 한 번에 변환 */
export function convertAll(input) {
  const out = {};
  for (const s of CASE_STYLES) out[s.key] = convertCase(input, s.key);
  return out;
}
