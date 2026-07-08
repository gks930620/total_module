// 인증 관련 엔드포인트 래퍼 (login.html / signup.html / header.html 계약 그대로)
//  - 공통 유틸(callApi/callPublicApi)만 사용한다 (설계원칙 3).
import { callApi, callPublicApi } from '../lib/http.js'

/**
 * 로그인. POST /api/login {username,password}
 * 성공 시 서버가 HttpOnly 쿠키를 설정한다(웹 브랜치는 바디가 비어 있음). 실패 시 표준 에러 throw.
 * 서버가 웹(쿠키) 응답을 내도록 Accept 에 text/html 을 포함시켜 브라우저 요청임을 알린다.
 */
export async function login(username, password) {
  return callPublicApi('/api/login', {
    method: 'POST',
    headers: { Accept: 'application/json, text/html' },
    body: JSON.stringify({ username, password }),
  })
}

/**
 * 회원가입. POST /api/join {username,password,email,nickname}
 * 실패 시 표준 에러(errors[] 포함 가능) throw.
 */
export async function join({ username, password, email, nickname }) {
  return callPublicApi('/api/join', {
    method: 'POST',
    body: JSON.stringify({ username, password, email, nickname }),
  })
}

/** 내 정보 조회. GET /api/my/info → { data: {...} } (인증 필요) */
export async function fetchMyInfo() {
  const body = await callApi('/api/my/info')
  return body.data ?? body
}
