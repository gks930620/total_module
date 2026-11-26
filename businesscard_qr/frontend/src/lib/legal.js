// 정적 법적 문서(약관·개인정보처리방침·계정 삭제 안내)로 가는 주소.
// 문서는 한국어·영어 두 가지뿐이다. 앱에서 고른 언어를 실어 보내야 브라우저 언어가 아니라
// 앱 언어로 열린다(public/legal.js 가 ?lang 을 먼저 본다).

/**
 * @param path     "/terms.html" 등
 * @param lang     앱 언어(6개 중 하나)
 * @param section  조항 앵커(선택). 영어 본문의 앵커는 "-en" 이 붙는다 — terms.html 의 id="refund" / id="refund-en".
 */
export function legalDocUrl(path, lang, section) {
  const docLang = lang === "ko" ? "ko" : "en";
  const anchor = section ? `#${docLang === "ko" ? section : `${section}-en`}` : "";
  return `${path}?lang=${docLang}${anchor}`;
}
