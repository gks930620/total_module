// 명함의 연락처 값을 링크(href)로 바꾼다. **보안 경계다.**
//
// 공개 명함(/c/:id)은 남이 입력한 값을 받는 사람의 브라우저에 링크로 보여준다.
// 그대로 href 에 넣으면 웹사이트 칸의 `javascript:...` 가 받는 사람 쪽에서 실행되는
// 저장형 XSS 가 된다. React 19 가 javascript: URL 을 일부 막아 주지만 거기에 기대지 않는다 —
// **허용 목록(http/https/tel/mailto)으로만 만든다.** 아니면 null 을 돌려주고, 화면은 링크 없이 글자로만 보여준다.

const ALLOWED_WEB_PROTOCOLS = new Set(["http:", "https:"]);

export function websiteHref(value) {
  // 브라우저는 URL 을 해석할 때 탭·줄바꿈을 지운다("java\tscript:" → "javascript:").
  // 그 전에 우리가 먼저 지워야 같은 기준으로 판단할 수 있다.
  const raw = String(value ?? "").replace(/[\t\n\r]/g, "").trim();
  if (!raw) return null;

  // 스킴이 없으면("example.com") https 를 붙인다. 스킴이 있으면 그대로 두고 아래에서 판단한다.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  let url;
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!ALLOWED_WEB_PROTOCOLS.has(url.protocol)) return null;
  // "그냥 글자" 같은 값은 https:// 를 붙이면 해석은 되지만 점 없는 호스트가 된다 — 주소가 아니다.
  if (!url.hostname.includes(".")) return null;
  return url.href;
}

export function telHref(value) {
  // 숫자와 + 만 남긴다(하이픈은 사람이 읽기 좋게 남겨도 다이얼러가 무시한다).
  const cleaned = String(value ?? "").replace(/[^\d+-]/g, "").replace(/(?!^)\+/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return null;
  // 국제번호(+)로 시작하면 하이픈 없이, 아니면 사람이 적은 하이픈을 살린다.
  return cleaned.startsWith("+") ? `tel:+${digits}` : `tel:${cleaned}`;
}

// 로컬@도메인.최상위. ?·&·공백·줄바꿈이 섞이면 mailto: 에 헤더(bcc 등)를 덧붙일 수 있어 거절한다.
const EMAIL = /^[^\s@?&=#/]+@[^\s@?&=#/]+\.[^\s@?&=#/]+$/;

export function mailtoHref(value) {
  const email = String(value ?? "").trim();
  return EMAIL.test(email) ? `mailto:${email}` : null;
}

/** 한국어 사용자는 국내 주소에 강한 카카오맵, 나머지는 구글 지도. */
export function mapHref(address, lang) {
  const query = String(address ?? "").trim();
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return lang === "ko"
    ? `https://map.kakao.com/link/search/${encoded}`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}
