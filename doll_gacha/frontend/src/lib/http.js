// 공통 HTTP 유틸 (설계원칙 3,4,9)
//  - 모든 API 호출은 이 모듈만 사용한다. 페이지마다 fetch 를 새로 구현하지 않는다.
//  - JWT 는 HttpOnly 쿠키 기반 → credentials:'include' 필수.
//  - 401 + TOKEN_EXPIRED 재발급/재시도 로직은 여기 한 곳에서만 처리한다.

let isRefreshing = false
let refreshSubscribers = []

function onRefreshed() {
  refreshSubscribers.forEach((cb) => cb())
  refreshSubscribers = []
}

async function tryRefreshToken() {
  try {
    const res = await fetch('/api/refresh/reissue', {
      method: 'POST',
      credentials: 'include',
    })
    return res.ok
  } catch {
    return false
  }
}

/** 표준 에러 객체로 변환 (설계원칙 9) */
export async function toApiError(response) {
  try {
    const data = await response.json()
    return {
      status: response.status,
      message: data.message || defaultMessage(response.status),
      errorCode: data.errorCode || 'UNKNOWN_ERROR',
      errors: data.errors || null,
    }
  } catch {
    return {
      status: response.status,
      message: defaultMessage(response.status),
      errorCode: 'UNKNOWN_ERROR',
      errors: null,
    }
  }
}

function defaultMessage(status) {
  switch (status) {
    case 400: return '잘못된 요청입니다.'
    case 401: return '로그인이 필요합니다.'
    case 403: return '권한이 없습니다.'
    case 404: return '요청한 리소스를 찾을 수 없습니다.'
    case 409: return '이미 처리된 요청입니다.'
    case 500: return '서버 오류가 발생했습니다.'
    default: return '오류가 발생했습니다.'
  }
}

/** 인증 fetch 래퍼: 401 TOKEN_EXPIRED 시 재발급 후 1회 재시도. Response 를 그대로 반환 */
export async function authFetch(url, options = {}) {
  const merged = { credentials: 'include', ...options }
  let response = await fetch(url, merged)

  if (response.status === 401) {
    let errorData = null
    try {
      errorData = await response.clone().json()
    } catch {
      return response
    }
    if (errorData && errorData.errorCode === 'TOKEN_EXPIRED') {
      if (!isRefreshing) {
        isRefreshing = true
        const ok = await tryRefreshToken()
        isRefreshing = false
        if (ok) {
          onRefreshed()
          await new Promise((r) => setTimeout(r, 50))
          return fetch(url, merged)
        }
        refreshSubscribers = []
        return response
      }
      // 이미 재발급 중이면 완료 후 재시도
      return new Promise((resolve) => {
        refreshSubscribers.push(async () => {
          await new Promise((r) => setTimeout(r, 50))
          resolve(fetch(url, merged))
        })
      })
    }
  }
  return response
}

/** 인증 필요한 JSON API 호출. 성공 시 JSON, 실패 시 표준 에러 throw */
export async function callApi(url, options = {}) {
  const opts = {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  }
  const response = await authFetch(url, opts)
  if (!response.ok) throw await toApiError(response)
  return parseBody(response)
}

/** 공개(비인증) JSON API 호출. 재발급 로직 없이 단순 호출 */
export async function callPublicApi(url, options = {}) {
  const opts = {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  }
  const response = await fetch(url, opts)
  if (!response.ok) throw await toApiError(response)
  return parseBody(response)
}

/** 성공 응답 본문 파싱. 204/빈 바디(예: 로그인 성공 쿠키 응답)는 { success:true } 로 통일 */
async function parseBody(response) {
  if (response.status === 204) return { success: true }
  const text = await response.text()
  return text ? JSON.parse(text) : { success: true }
}
