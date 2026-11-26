// ApiError → 화면에 보일 문장. 앱의 AppErrorText 와 같은 역할이다.
// 오류를 `${e}` 로 그냥 찍으면 서버의 한국어 문장이나 JS 예외 문자열이 언어와 무관하게 새어 나온다.
// 토스트·알림은 항상 이 함수를 거친다.
import { ApiError, CLIENT_ERROR } from "./http.js";
import { MAX_UPLOAD_MB } from "./image.js";

const BY_CODE = {
  [CLIENT_ERROR.TIMEOUT]: "errorTimeout",
  [CLIENT_ERROR.SERVER_WAKING]: "errorServerWaking",
  [CLIENT_ERROR.NETWORK]: "errorNetwork",
  CARD_LIMIT_EXCEEDED: "errorCardLimitExceeded",
  STORE_UNAVAILABLE: "errorStoreUnavailable",
  UNSUPPORTED_IMAGE: "errorUnsupportedImage",
  // 웹 결제(토스) — 서버 PaymentException
  PAYMENT_UNAVAILABLE: "errorPaymentUnavailable",
  ALREADY_LIFETIME: "errorAlreadyLifetime",
  PAYMENT_AMOUNT_MISMATCH: "errorPaymentAmountMismatch",
  ORDER_CLOSED: "errorOrderClosed",
};

export function errorText(t, lang, error) {
  if (!(error instanceof ApiError)) return t("errorUnknown");

  // 결제 거절의 서버 메시지는 토스가 사용자에게 보여주라고 만든 구체적인 안내다("카드 한도가 초과되었습니다" 등).
  // 다만 한국어 고정이라 다른 언어에선 일반 문구로 대신한다.
  if (error.errorCode === "PAYMENT_REJECTED") {
    return lang === "ko" && error.message && error.message !== error.errorCode ? error.message : t("errorPaymentRejected");
  }

  if (error.errorCode === "IMAGE_TOO_LARGE" || error.status === 413) {
    return t("errorImageTooLarge", { max: MAX_UPLOAD_MB });
  }
  const key = BY_CODE[error.errorCode];
  if (key) return t(key);

  if (error.status === 401) return t("errorSessionExpired");
  if (error.status === 404) return t("errorNotFound");

  // 서버 메시지는 아직 한국어 고정이다(서버 다국어는 별도 과제).
  // 한국어 사용자에게는 더 구체적이라 그대로 보여주고, 다른 언어에선 일반 문장으로 대신한다.
  if (lang === "ko" && error.message && error.message !== error.errorCode) return error.message;
  return error.status ? t("errorServer", { statusCode: error.status }) : t("errorUnknown");
}
