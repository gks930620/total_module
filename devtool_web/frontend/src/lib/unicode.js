// 유니코드 문자 분석 · 한글 자모 분해/조합 — 전부 클라이언트(NFR-02).

const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

const encoder = new TextEncoder();

// 유니코드 블록 — 자주 마주치는 것 위주
const BLOCKS = [
  [0x0000, 0x007f, "기본 라틴 (ASCII)"],
  [0x0080, 0x00ff, "라틴-1 보충"],
  [0x0100, 0x017f, "라틴 확장-A"],
  [0x0370, 0x03ff, "그리스"],
  [0x0400, 0x04ff, "키릴"],
  [0x1100, 0x11ff, "한글 자모"],
  [0x2000, 0x206f, "일반 구두점"],
  [0x20a0, 0x20cf, "통화 기호"],
  [0x2190, 0x21ff, "화살표"],
  [0x2200, 0x22ff, "수학 연산자"],
  [0x2500, 0x257f, "괘선 문자"],
  [0x3000, 0x303f, "CJK 기호 및 구두점"],
  [0x3040, 0x309f, "히라가나"],
  [0x30a0, 0x30ff, "가타카나"],
  [0x3130, 0x318f, "한글 호환 자모"],
  [0x4e00, 0x9fff, "CJK 통합 한자"],
  [0xac00, 0xd7a3, "한글 음절"],
  [0xf900, 0xfaff, "CJK 호환 한자"],
  [0x1f300, 0x1f5ff, "기타 기호 및 그림문자"],
  [0x1f600, 0x1f64f, "이모티콘"],
  [0x1f680, 0x1f6ff, "교통 및 지도 기호"],
  [0x1f900, 0x1f9ff, "보충 기호 및 그림문자"],
];

function blockOf(cp) {
  for (const [lo, hi, name] of BLOCKS) {
    if (cp >= lo && cp <= hi) return name;
  }
  return "기타";
}

const CONTROL_NAMES = {
  0x00: "NULL", 0x07: "BELL", 0x08: "BACKSPACE", 0x09: "TAB",
  0x0a: "LINE FEED (\\n)", 0x0d: "CARRIAGE RETURN (\\r)", 0x1b: "ESCAPE", 0x7f: "DELETE",
  0x20: "SPACE", 0xa0: "NO-BREAK SPACE", 0x200b: "ZERO WIDTH SPACE",
  0x200d: "ZERO WIDTH JOINER (이모지 결합)", 0xfeff: "BYTE ORDER MARK",
};

/** 문자열의 각 문자(코드포인트 단위) 정보 */
export function inspectChars(text) {
  return Array.from(String(text ?? "")).map((ch) => {
    const cp = ch.codePointAt(0);
    const bytes = encoder.encode(ch);
    const utf16 = [];
    for (let i = 0; i < ch.length; i++) utf16.push(ch.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase());

    return {
      char: ch,
      codePoint: cp,
      hex: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
      decimal: cp,
      block: blockOf(cp),
      controlName: CONTROL_NAMES[cp] || null,
      utf8: Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" "),
      utf8Length: bytes.length,
      utf16: utf16.join(" "),
      jsEscape:
        cp > 0xffff
          ? `\\u{${cp.toString(16)}}`
          : `\\u${cp.toString(16).padStart(4, "0")}`,
      htmlEntity: `&#${cp};`,
      htmlHexEntity: `&#x${cp.toString(16).toUpperCase()};`,
      urlEncoded: encodeURIComponent(ch),
    };
  });
}

/** 완성형 한글 → 초/중/종성 */
export function decomposeHangul(text) {
  return Array.from(String(text ?? "")).map((ch) => {
    const cp = ch.codePointAt(0);
    if (cp < HANGUL_BASE || cp > HANGUL_END) {
      return { char: ch, cho: "", jung: "", jong: "", isHangul: false };
    }
    const offset = cp - HANGUL_BASE;
    return {
      char: ch,
      cho: CHO[Math.floor(offset / 588)],
      jung: JUNG[Math.floor((offset % 588) / 28)],
      jong: JONG[offset % 28],
      isHangul: true,
    };
  });
}

/** 초/중/종성 → 완성형 한글 */
export function composeHangul(cho, jung, jong = "") {
  const ci = CHO.indexOf(cho);
  const ji = JUNG.indexOf(jung);
  const ki = JONG.indexOf(jong || "");
  if (ci < 0 || ji < 0 || ki < 0) return "";
  return String.fromCodePoint(HANGUL_BASE + ci * 588 + ji * 28 + ki);
}

/** 초성만 추출 (초성 검색 구현용) */
export function extractChoseong(text) {
  return decomposeHangul(text)
    .map((d) => (d.isHangul ? d.cho : d.char))
    .join("");
}

/**
 * 중성(모음)만 추출.
 *
 * <p>초성 추출({@link extractChoseong})과 짝이다. 겹모음(ㅢ·ㅙ)은 유니코드에서
 * 이미 한 글자라 그대로 낸다 — ㅡ+ㅣ 로 더 쪼개지 않는다.
 * 한글이 아닌 글자는 건드리지 않는다.
 */
export function extractJungseong(text) {
  return decomposeHangul(text)
    .map((d) => (d.isHangul ? d.jung : d.char))
    .join("");
}

/**
 * 자모로 풀어쓰기 — 한 → ㅎㅏㄴ.
 *
 * <p>종성이 없으면 두 자만 나온다(희 → ㅎㅢ). 겹받침은 유니코드가 한 글자로 갖고 있어
 * 그대로 둔다(값 → ㄱㅏㅄ). 한글이 아닌 글자는 건드리지 않는다.
 */
export function decomposeToJamo(text) {
  return decomposeHangul(text)
    .map((d) => (d.isHangul ? d.cho + d.jung + d.jong : d.char))
    .join("");
}
