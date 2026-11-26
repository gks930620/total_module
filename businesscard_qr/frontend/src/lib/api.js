// 백엔드 엔드포인트 목록. 경로·필드 이름은 백엔드 계약과 1:1 이다
// (businesscard_qr/설계/웹앱_전환_설계.md, 인앱결제_설계.md).
// 화면은 fetch 를 직접 부르지 않고 여기 함수만 쓴다.
import { request } from "./http.js";

const card = (id) => `/api/business-cards/${encodeURIComponent(id)}`;

/** 로그인 버튼이 가는 곳. 서버가 카카오 OAuth 를 처리하고 세션 쿠키를 심은 뒤 /cards 로 돌려보낸다. */
export const KAKAO_LOGIN_URL = "/api/auth/kakao/authorize";

/** 받는 사람이 바로 연락처로 저장하는 vCard. 토큰·로그인이 필요 없다. */
export const publicVcfUrl = (id) => `${card(id)}/public/vcf`;

/**
 * 명함 등록·수정 본문. 이미지와 같이 보내야 해서 multipart 다.
 * payload 는 문자열 파트로 보낸다 — 서버는 {@code @RequestPart("payload") String} 으로 받아 직접 검증한다.
 */
function cardForm(fields, image) {
  const form = new FormData();
  form.append("payload", JSON.stringify(toPayload(fields)));
  if (image) form.append("businessCardImage", image.blob, image.name);
  return form;
}

/**
 * 화면 필드(camelCase) → 서버 DTO {@code BusinessCardUpsertRequest}(snake_case 섞임).
 * 빈 값은 보내지 않는다. 테스트가 이 이름들을 지킨다 — 하나만 틀려도 서버가 "full_name은 필수" 로 거절한다.
 */
export function toPayload(fields) {
  const payload = {
    full_name: fields.fullName,
    phone: fields.phone,
    email: fields.email,
    website: fields.website,
    organization: fields.organization,
    title: fields.title,
    address: fields.address,
    note: fields.note,
  };
  return Object.fromEntries(
    Object.entries(payload)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

export const api = {
  entitlement: () => request("/api/billing/entitlement"),

  // 웹 결제 — 프로 평생 이용권(설계 웹결제_설계.md). 금액은 항상 서버가 정한다.
  lifetimeOffer: () => request("/api/billing/web/lifetime"),
  createLifetimeOrder: () => request("/api/billing/web/orders", { method: "POST" }),
  confirmPayment: (orderId, paymentKey, amount) =>
    request(`/api/billing/web/orders/${encodeURIComponent(orderId)}/confirm`, {
      method: "POST",
      body: { payment_key: paymentKey, amount },
    }),

  listCards: (page, size = 20) => request(`/api/business-cards?page=${page}&size=${size}`),
  getCard: (id) => request(card(id)),
  createCard: (fields, image) => request("/api/business-cards", { method: "POST", body: cardForm(fields, image) }),
  updateCard: (id, fields, image) => request(card(id), { method: "PUT", body: cardForm(fields, image) }),
  deleteCard: (id) => request(card(id), { method: "DELETE" }),

  publicCard: (id) => request(`${card(id)}/public`),
  countView: (id) => request(`${card(id)}/view-count`, { method: "POST" }),

  logout: () => request("/api/auth/logout", { method: "POST" }),
  deleteAccount: () => request("/api/users/me", { method: "DELETE" }),
};
