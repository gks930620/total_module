// URL 인코딩/디코딩 · 쿼리스트링 파서 — 전부 클라이언트(NFR-02).
// component(전체 이스케이프)와 full(URL 구조 문자 보존)을 구분해 제공한다.

/** 모든 예약문자를 인코딩 (파라미터 "값"에 쓰는 것) */
export function encodeComponent(text) {
  return encodeURIComponent(String(text ?? ""));
}

/** percent 디코딩. 잘못된 시퀀스는 예외를 던진다(호출부에서 안내 문구로 처리). */
export function decodeComponent(text) {
  return decodeURIComponent(String(text ?? ""));
}

/** URL 구조 문자(: / ? & = # 등)는 보존하고 나머지만 인코딩 (URL 전체에 쓰는 것) */
export function encodeFull(text) {
  return encodeURI(String(text ?? ""));
}

/** encodeFull 의 역변환 */
export function decodeFull(text) {
  return decodeURI(String(text ?? ""));
}

/** URL 을 구성요소로 분해. 스킴이 없거나 파싱 실패면 { ok:false }. */
export function parseUrl(input) {
  const s = String(input ?? "").trim();
  try {
    const u = new URL(s);
    return {
      ok: true,
      protocol: u.protocol,
      username: u.username,
      password: u.password,
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      origin: u.origin,
      // 경로를 세그먼트로 쪼개 표에 보여준다
      segments: u.pathname.split("/").filter(Boolean),
    };
  } catch {
    return {
      ok: false,
      reason: "URL 로 해석할 수 없습니다. 스킴(https:// 등)을 포함했는지 확인해 주세요.",
    };
  }
}

function safeDecodePlus(raw) {
  // application/x-www-form-urlencoded 관례: + 는 공백
  const replaced = String(raw).replace(/\+/g, " ");
  try {
    return decodeURIComponent(replaced);
  } catch {
    return replaced; // 깨진 시퀀스는 원문 그대로 보여준다(파싱 전체가 죽지 않도록)
  }
}

/**
 * 쿼리스트링을 키/값 행 배열로 분해한다.
 * URL 전체를 넣어도 ? 뒤만 파싱한다. 같은 키가 반복돼도 전부 보존(URLSearchParams 와 달리 순서·중복 유지).
 * 값이 없는 키(`?flag`)는 value=null, 빈 값(`?k=`)은 value="" 로 구분한다.
 */
export function parseQuery(input) {
  let s = String(input ?? "").trim();
  const q = s.indexOf("?");
  if (q >= 0) s = s.slice(q + 1);
  const hash = s.indexOf("#");
  if (hash >= 0) s = s.slice(0, hash);
  if (!s) return [];

  return s
    .split("&")
    .filter((pair) => pair !== "")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) {
        return { key: safeDecodePlus(pair), value: null, raw: null };
      }
      const raw = pair.slice(eq + 1);
      return { key: safeDecodePlus(pair.slice(0, eq)), value: safeDecodePlus(raw), raw };
    });
}

/** 키/값 행 배열 → 쿼리스트링 (parseQuery 의 역변환) */
export function buildQuery(rows) {
  return (rows || [])
    .filter((r) => r && r.key !== "" && r.key != null)
    .map((r) =>
      r.value == null
        ? encodeComponent(r.key)
        : `${encodeComponent(r.key)}=${encodeComponent(r.value)}`
    )
    .join("&");
}
