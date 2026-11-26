// 공통 HTTP — 모든 API 호출은 이 모듈만 거친다(코드컨벤션 §7, doll_gacha lib/http.js 와 같은 역할).
//
// 세션은 서버가 심는 HttpOnly 쿠키다. 이 파일은 토큰을 **보지도 저장하지도 않는다**
// (localStorage 에 토큰을 두면 XSS 한 번에 그대로 털린다).
// 여기서 하는 일:
//   ① 응답을 { success, data } 형식에서 data 로 풀어 준다
//   ② 401 이면 세션을 **한 번만** 갱신하고 원래 요청을 다시 보낸다
//   ③ 실패를 errorCode 중심의 ApiError 하나로 통일한다 — 화면은 문장이 아니라 코드로 분기한다

/** 서버가 준 errorCode 외에, 이 모듈이 직접 붙이는 코드 */
export const CLIENT_ERROR = Object.freeze({
  NETWORK: "NETWORK",
  TIMEOUT: "TIMEOUT",
  /** Railway App Sleeping — 첫 요청이 서버를 깨우는 동안 프록시가 502/503/504 를 낸다 */
  SERVER_WAKING: "SERVER_WAKING",
  UNKNOWN: "UNKNOWN",
});

export class ApiError extends Error {
  constructor({ status = 0, errorCode = CLIENT_ERROR.UNKNOWN, message = "", fieldErrors = null } = {}) {
    super(message || errorCode);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * 서버가 깨어나는 데 10~30초 걸릴 수 있어(App Sleeping) 넉넉히 잡는다.
 * 이보다 짧으면 첫 화면이 "응답 없음"으로 실패한다.
 */
const DEFAULT_TIMEOUT_MS = 35_000;

const REFRESH_PATH = "/api/auth/refresh";

export function createHttp({
  fetchImpl = (...args) => globalThis.fetch(...args),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onSessionExpired = () => {},
} = {}) {
  // 진행 중인 갱신을 공유한다. 동시에 여러 요청이 401 을 받아도 갱신은 한 번만 나간다 —
  // 여러 번 나가면 refresh 토큰 회전이 서로의 결과를 덮어써 세션이 끊길 수 있다.
  let refreshing = null;

  async function send(path, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(path, { ...init, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new ApiError({ errorCode: CLIENT_ERROR.TIMEOUT });
      }
      throw new ApiError({ errorCode: CLIENT_ERROR.NETWORK, message: String(error?.message ?? "") });
    } finally {
      clearTimeout(timer);
    }
  }

  function refreshSession() {
    if (!refreshing) {
      refreshing = send(REFRESH_PATH, { method: "POST", credentials: "same-origin", headers: {} })
        .then((response) => response.ok)
        .catch(() => false)
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }

  async function request(path, { method = "GET", body, headers = {} } = {}) {
    const init = {
      method,
      // 같은 오리진이라 쿠키는 기본으로 실리지만, 의도를 코드에 남겨 둔다.
      credentials: "same-origin",
      headers: { Accept: "application/json", ...headers },
    };
    if (body instanceof FormData) {
      // Content-Type 을 넣지 않는다. 브라우저가 multipart boundary 를 붙여 줘야 서버가 읽는다.
      init.body = body;
    } else if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] = "application/json";
    }

    let response = await send(path, init);

    // 인증 엔드포인트 자체는 갱신을 시도하지 않는다 — 갱신 요청이 401 이면 무한 루프가 된다.
    if (response.status === 401 && !path.startsWith("/api/auth/")) {
      if (await refreshSession()) {
        response = await send(path, init); // 단 한 번만 재시도
      }
      if (response.status === 401) {
        onSessionExpired();
      }
    }

    return parse(response);
  }

  return { request };
}

async function parse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null; // JSON 이 아닌 응답 — 대개 프록시의 HTML 오류 페이지다
  }

  if (body === null) {
    if ([502, 503, 504].includes(response.status)) {
      throw new ApiError({ status: response.status, errorCode: CLIENT_ERROR.SERVER_WAKING });
    }
    if (response.ok) return null;
    throw new ApiError({ status: response.status });
  }

  if (!response.ok || body.success !== true) {
    // JSON 으로 온 503 은 서버가 이유를 준 것이다(예: STORE_UNAVAILABLE). 덮어쓰지 않는다.
    throw new ApiError({
      status: response.status,
      errorCode: body.errorCode || CLIENT_ERROR.UNKNOWN,
      message: body.message || "",
      fieldErrors: body.errors || null,
    });
  }
  return body.data ?? null;
}

// ── 앱 전체가 쓰는 기본 인스턴스 ───────────────────────────────

let sessionExpiredHandler = () => {};

/** 세션이 완전히 끊겼을 때(갱신까지 실패) 할 일. AuthProvider 가 등록한다. */
export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

const defaultHttp = createHttp({ onSessionExpired: () => sessionExpiredHandler() });

export const request = defaultHttp.request;
