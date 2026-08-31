// 텍스트 실무 도구 모음 — 전부 클라이언트(NFR-02).
// 글자수·원고지 / 줄바꿈 복구 / 목록 비교 / 개인정보 마스킹.

const encoder = new TextEncoder();

// ── 글자수 · 원고지 ────────────────────────────────────────

/**
 * 글자수 상세. textUtil.textStats 보다 세분화된 값을 준다(원고지·공백 종류별 등).
 */
/**
 * **사람이 보는 글자 수**를 센다.
 *
 * <p>세는 방법이 셋이나 되고 값이 전부 다르다. 👨‍👩‍👧 하나가
 * UTF-16 코드유닛 8 · 코드포인트 5(이모지 3 + ZWJ 2) · 사람 눈에는 1 이다.
 * 글자수 세기 도구에서 "8글자" 라고 하면 그냥 틀린 답이다.
 *
 * <p>`Intl.Segmenter` 가 유니코드 규칙대로 끊어 준다. 없는 환경에서는 코드포인트로
 * 물러선다 — 이모지에서는 어긋나지만 한글·영문에서는 같은 값이다.
 */
function countGraphemes(s) {
  if (s === "") return 0;
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const seg = new Intl.Segmenter("ko", { granularity: "grapheme" });
    let n = 0;
    for (const _ of seg.segment(s)) n += 1;
    return n;
  }
  return Array.from(s).length;
}

export function countDetail(text) {
  const s = String(text ?? "");
  const noSpace = s.replace(/\s/g, "");
  const noWhitespaceAll = s.replace(/[\s\u200B\uFEFF\u00A0]/g, "");
  const words = s.trim() === "" ? 0 : s.trim().split(/\s+/).length;
  const lines = s === "" ? 0 : s.split(/\r\n|\r|\n/).length;
  const paragraphs = s.trim() === "" ? 0 : s.split(/\n\s*\n/).filter((p) => p.trim() !== "").length;

  // 문자 종류별
  const hangul = (s.match(/[가-힣]/g) || []).length;
  const hangulJamo = (s.match(/[ㄱ-ㅎㅏ-ㅣ]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  const digit = (s.match(/[0-9]/g) || []).length;
  const cjk = (s.match(/[一-鿿]/g) || []).length;

  return {
    chars: s.length,                        // JS 길이(UTF-16 코드유닛)
    graphemes: countGraphemes(s),           // 사람이 보는 글자 수
    codePoints: Array.from(s).length,       // 코드포인트
    charsNoSpace: noSpace.length,           // 공백 제외
    charsNoSpaceStrict: noWhitespaceAll.length, // 보이지 않는 공백까지 제외
    words, lines, paragraphs,
    bytesUtf8: encoder.encode(s).length,
    bytesEucKrApprox: hangul * 2 + cjk * 2 + (s.length - hangul - cjk), // 근사치
    hangul, hangulJamo, latin, digit, cjk,
    // 원고지: 200자 = 20자×10행 1매. 공백 포함이 관례
    manuscript200: Math.ceil(s.length / 200) || 0,
    manuscript200Exact: Number((s.length / 200).toFixed(2)),
    manuscript400: Math.ceil(s.length / 400) || 0,
    // 보이지 않는 문자(붙여넣기 사고의 주범)
    invisible: {
      zeroWidth: (s.match(/[\u200B-\u200D\uFEFF]/g) || []).length,
      nbsp: (s.match(/\u00A0/g) || []).length,
      tab: (s.match(/\t/g) || []).length,
      trailingSpaceLines: s.split("\n").filter((l) => /[ \t]$/.test(l)).length,
    },
  };
}

/** SNS·서식별 글자수 제한 대비 */
export const LENGTH_LIMITS = [
  { key: "sms", label: "SMS (단문)", limit: 90, unit: "bytes", note: "EUC-KR 90바이트 초과 시 LMS" },
  { key: "twitter", label: "X (트위터)", limit: 280, unit: "chars" },
  { key: "metaDesc", label: "meta description", limit: 160, unit: "chars", note: "검색 결과 노출 기준" },
  { key: "ogTitle", label: "og:title", limit: 60, unit: "chars" },
  { key: "youtubeTitle", label: "유튜브 제목", limit: 100, unit: "chars" },
  { key: "instagram", label: "인스타그램 본문", limit: 2200, unit: "chars" },
];

// ── 줄바꿈 정리 ────────────────────────────────────────────

/**
 * PDF·논문에서 복사하면 줄마다 개행이 들어가 문단이 깨진다. 그걸 복구한다.
 *
 * 규칙: 문장이 끝나지 않은 줄(마침표·물음표 등으로 안 끝남) 뒤의 개행을 공백으로 바꾼다.
 *       빈 줄(문단 구분)은 보존한다.
 */
export function joinBrokenLines(text, { keepParagraphs = true, removeHyphen = true } = {}) {
  const src = String(text ?? "").replace(/\r\n?/g, "\n");
  const blocks = keepParagraphs ? src.split(/\n{2,}/) : [src];

  // 목록·인용처럼 "원래 줄이 나뉘어야 하는" 줄은 이어붙이지 않는다
  const isListItem = (l) => /^([-*•·▪◦]|\(?\d{1,2}[.)]|[가-힣][.)]|[ivxIVX]+[.)]|>|#{1,6}\s)/.test(l);

  const joined = blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    let out = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0) { out = line; continue; }

      const prev = out;
      // 영문 하이픈 줄바꿈(inter-\nnational) 복구 — 여기만 공백 없이 붙인다
      if (removeHyphen && /[A-Za-z]-$/.test(prev)) {
        out = prev.slice(0, -1) + line;
        continue;
      }

      // 개행을 유지해야 하는 경우: 이전 줄이 문장부호로 끝났거나, 다음 줄이 목록 항목
      const keepBreak = /[.!?。！？:;]$/.test(prev) || isListItem(line);
      if (keepBreak) { out = `${prev}\n${line}`; continue; }

      // 이어붙일 때는 공백을 넣는다.
      // PDF 줄바꿈은 대부분 띄어쓰기 자리에서 일어나므로 한글도 공백이 필요하다.
      // 예외는 띄어쓰기를 쓰지 않는 CJK 한자·가나뿐이다.
      const cjkNoSpace = /[一-鿿぀-ゟ゠-ヿ]$/.test(prev) && /^[一-鿿぀-ゟ゠-ヿ]/.test(line);
      out = `${prev}${cjkNoSpace ? "" : " "}${line}`;
    }
    return out;
  });

  return joined.join("\n\n");
}

/** 반대 방향: 지정 폭에서 강제 개행 제거 등 부수 정리 */
export function cleanupText(text, { collapseSpaces = true, trimLines = true, removeEmpty = false, normalizeQuotes = false } = {}) {
  let s = String(text ?? "").replace(/\r\n?/g, "\n");
  // 보이지 않는 공백 제거
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ");
  if (collapseSpaces) s = s.replace(/[ \t]{2,}/g, " ");
  if (trimLines) s = s.split("\n").map((l) => l.trim()).join("\n");
  if (removeEmpty) s = s.split("\n").filter((l) => l !== "").join("\n");
  if (normalizeQuotes) s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-");
  return s.replace(/\n{3,}/g, "\n\n");
}

// ── 목록 비교 ──────────────────────────────────────────────

/**
 * 두 목록의 교집합·차집합. 엑셀 VLOOKUP 대신 쓰는 용도.
 */
export function compareLists(leftText, rightText, { ignoreCase = false, trim = true, ignoreEmpty = true } = {}) {
  const norm = (v) => {
    let x = v;
    if (trim) x = x.trim();
    if (ignoreCase) x = x.toLowerCase();
    return x;
  };
  const split = (t) => {
    const rows = String(t ?? "").replace(/\r\n?/g, "\n").split("\n");
    return ignoreEmpty ? rows.filter((r) => r.trim() !== "") : rows;
  };

  const leftRaw = split(leftText);
  const rightRaw = split(rightText);
  const leftSet = new Map();
  const rightSet = new Map();
  for (const v of leftRaw) { const k = norm(v); if (!leftSet.has(k)) leftSet.set(k, v); }
  for (const v of rightRaw) { const k = norm(v); if (!rightSet.has(k)) rightSet.set(k, v); }

  const both = [];
  const onlyLeft = [];
  const onlyRight = [];
  for (const [k, v] of leftSet) (rightSet.has(k) ? both : onlyLeft).push(v);
  for (const [k, v] of rightSet) if (!leftSet.has(k)) onlyRight.push(v);

  // 각 목록 내부 중복
  const dupOf = (raw) => {
    const seen = new Set();
    const dup = new Set();
    for (const v of raw) { const k = norm(v); if (seen.has(k)) dup.add(v); else seen.add(k); }
    return [...dup];
  };

  return {
    both, onlyLeft, onlyRight,
    leftCount: leftRaw.length, rightCount: rightRaw.length,
    leftUnique: leftSet.size, rightUnique: rightSet.size,
    leftDuplicates: dupOf(leftRaw), rightDuplicates: dupOf(rightRaw),
    union: [...both, ...onlyLeft, ...onlyRight],
  };
}