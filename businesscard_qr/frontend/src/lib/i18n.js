// 다국어 — 순수 로직만 둔다(React 없이 테스트할 수 있게). 화면 쪽 배선은 I18nProvider.jsx.
//
// 라이브러리를 쓰지 않는다: 필요한 건 "키 → 문장 + {자리표시자} + 복수형" 뿐이라
// 20줄이면 끝나고, 의존성을 하나 늘리는 것보다 낫다(새 라이브러리는 senior-dev 결정 사항).

/** 앱과 같은 6개 언어. 순서는 언어 선택 메뉴에 그대로 쓰인다. */
export const SUPPORTED_LANGUAGES = ["ko", "en", "ja", "zh", "es", "de"];

/** 어느 언어에도 맞지 않을 때. 비한국어권 사용자에게 가장 넓게 통한다. */
export const FALLBACK_LANGUAGE = "en";

/**
 * 쓸 언어를 고른다. 우선순위: 사용자가 직접 고른 값 → 브라우저 선호 순서 → 영어.
 * @param {readonly string[]} navigatorLanguages  navigator.languages
 * @param {string|null} saved  사용자가 고른 값(없으면 null)
 */
export function pickLanguage(navigatorLanguages, saved) {
  if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
  for (const tag of navigatorLanguages ?? []) {
    // "zh-CN" → "zh". 지역 변형까지 따로 번역하지 않는다.
    const base = String(tag).toLowerCase().split("-")[0];
    if (SUPPORTED_LANGUAGES.includes(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}

/**
 * 키를 문장으로 바꾼다.
 *
 * - 현재 언어에 없으면 영어 문장으로 대신한다 — 빈칸보다 낫다.
 * - 어디에도 없으면 **키 이름을 그대로** 보여준다 — 조용히 사라지면 빠진 번역을 아무도 모른다.
 * - {@code params.count} 가 있으면 언어 규칙(Intl.PluralRules)으로 `_one`/`_other` 를 고른다.
 */
export function translate(lang, messages, fallbackMessages, key, params = {}) {
  const template = lookup(lang, messages, key, params) ?? lookup(FALLBACK_LANGUAGE, fallbackMessages, key, params);
  if (template === undefined) return key;
  return interpolate(template, params);
}

function lookup(lang, messages, key, params) {
  if (!messages) return undefined;
  if (typeof params.count === "number") {
    const category = new Intl.PluralRules(lang).select(params.count);
    return messages[`${key}_${category}`] ?? messages[`${key}_other`] ?? messages[key];
  }
  return messages[key];
}

/**
 * 가격 표기. 한국어는 "9,900원"(국내에서 가장 익숙한 표기), 다른 언어는 그 언어의 통화 표기("₩9,900").
 * 값이 없으면 빈 문자열 — 가격을 아직 못 받았을 때 "NaN원" 이 보이지 않게.
 */
export function formatPrice(lang, amount, currency) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  if (lang === "ko" && currency === "KRW") return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
  return new Intl.NumberFormat(lang, { style: "currency", currency }).format(amount);
}

/**
 * 한 번에 치환한다. 끼운 값 안에 `{...}` 가 있어도 다시 치환하지 않는다 —
 * 사용자 입력(이름 등)을 끼울 때 그게 다른 자리표시자로 해석되면 안 된다.
 */
function interpolate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}
