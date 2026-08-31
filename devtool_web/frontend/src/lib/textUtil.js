// 텍스트 줄 단위 유틸 — 전부 클라이언트(NFR-02).
// 로그·목록·쿼리 결과를 붙여넣고 정렬·중복제거·번호매기기 하는 잡무용.

const split = (text) => String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
const join = (lines) => lines.join("\n");

// 한국어 로케일 비교 — "가나다" 순 + 대소문자 관용
const collator = new Intl.Collator("ko", { sensitivity: "base" });
const naturalCollator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

/** 줄 정렬. { desc, natural } */
export function sortLines(text, { desc = false, natural = false } = {}) {
  const cmp = natural ? naturalCollator.compare : collator.compare;
  const sorted = split(text).sort(cmp);
  return join(desc ? sorted.reverse() : sorted);
}

/** 중복 줄 제거 (첫 등장 순서 유지) */
export function dedupeLines(text, { ignoreCase = false, trim = false } = {}) {
  const seen = new Set();
  const out = [];
  for (const line of split(text)) {
    let key = line;
    if (trim) key = key.trim();
    if (ignoreCase) key = key.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return join(out);
}

/** 각 줄 양끝 공백 제거 */
export function trimLines(text) {
  return join(split(text).map((l) => l.trim()));
}

/** 빈 줄(공백만인 줄 포함) 제거 */
export function removeEmptyLines(text) {
  return join(split(text).filter((l) => l.trim() !== ""));
}

/** 줄 번호 붙이기 */
export function numberLines(text, { start = 1, separator = ". ", pad = false } = {}) {
  const lines = split(text);
  const width = String(start + lines.length - 1).length;
  return join(
    lines.map((l, i) => {
      const n = String(start + i);
      return `${pad ? n.padStart(width, "0") : n}${separator}${l}`;
    })
  );
}

/** 줄 순서 뒤집기 */
export function reverseLines(text) {
  return join(split(text).reverse());
}

/** 각 줄 앞뒤에 문자열 붙이기 (따옴표 씌우기 등에 유용) */
export function affixLines(text, { prefix = "", suffix = "" } = {}) {
  return join(split(text).map((l) => `${prefix}${l}${suffix}`));
}

/** 지정 폭으로 줄바꿈 (단어 경계 우선) */
export function wrapLines(text, { width = 80 } = {}) {
  const out = [];
  for (const line of split(text)) {
    if (line.length <= width) {
      out.push(line);
      continue;
    }
    let current = "";
    for (const word of line.split(" ")) {
      if (current === "") {
        current = word;
      } else if ((current + " " + word).length <= width) {
        current += " " + word;
      } else {
        out.push(current);
        current = word;
      }
    }
    if (current) out.push(current);
  }
  return join(out);
}

const encoder = new TextEncoder();

/** 글자·줄·단어·바이트 통계 */
export function textStats(text) {
  const s = String(text ?? "");
  const lines = s === "" ? 0 : split(s).length;
  const words = s.trim() === "" ? 0 : s.trim().split(/\s+/).length;
  // 이모지·서로게이트 쌍을 1로 세는 코드포인트 기준 길이
  const graphemes = Array.from(s).length;
  return {
    chars: s.length, // UTF-16 코드유닛 (JS .length 와 동일)
    graphemes,
    charsNoSpace: s.replace(/\s/g, "").length,
    words,
    lines,
    bytes: encoder.encode(s).length, // UTF-8 바이트
  };
}
