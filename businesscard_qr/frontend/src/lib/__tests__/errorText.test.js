// 오류 → 문장. 서버의 한국어 메시지나 JS 예외 문자열이 다른 언어 화면에 새지 않게 한다.
import { describe, it, expect } from "vitest";
import { errorText } from "../errorText.js";
import { ApiError } from "../http.js";

// 키와 인자를 그대로 보여주는 가짜 t — 어떤 키를 골랐는지만 본다.
const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key);

describe("errorText", () => {
  it("서버 errorCode 를 번역 키로 바꾼다", () => {
    expect(errorText(t, "en", new ApiError({ status: 400, errorCode: "CARD_LIMIT_EXCEEDED" }))).toBe(
      "errorCardLimitExceeded",
    );
  });

  it("서버가 깨어나는 중 / 네트워크 / 시간 초과를 구분한다", () => {
    expect(errorText(t, "en", new ApiError({ errorCode: "SERVER_WAKING" }))).toBe("errorServerWaking");
    expect(errorText(t, "en", new ApiError({ errorCode: "NETWORK" }))).toBe("errorNetwork");
    expect(errorText(t, "en", new ApiError({ errorCode: "TIMEOUT" }))).toBe("errorTimeout");
  });

  it("용량 초과(413)는 한도 숫자와 함께 알려준다", () => {
    expect(errorText(t, "en", new ApiError({ status: 413 }))).toBe('errorImageTooLarge:{"max":10}');
  });

  it("한국어 화면에선 서버의 구체적인 메시지를 그대로 보여준다", () => {
    const error = new ApiError({ status: 400, errorCode: "BUSINESS_RULE_VIOLATION", message: "note는 500자를 넘을 수 없습니다." });
    expect(errorText(t, "ko", error)).toBe("note는 500자를 넘을 수 없습니다.");
  });

  it("다른 언어 화면엔 서버의 한국어 메시지를 내보내지 않는다", () => {
    const error = new ApiError({ status: 400, errorCode: "BUSINESS_RULE_VIOLATION", message: "note는 500자를 넘을 수 없습니다." });
    expect(errorText(t, "de", error)).toBe('errorServer:{"statusCode":400}');
  });

  it("결제 오류 코드를 각각의 문구로 바꾼다", () => {
    expect(errorText(t, "en", new ApiError({ status: 503, errorCode: "PAYMENT_UNAVAILABLE" }))).toBe("errorPaymentUnavailable");
    expect(errorText(t, "en", new ApiError({ status: 409, errorCode: "ALREADY_LIFETIME" }))).toBe("errorAlreadyLifetime");
    expect(errorText(t, "en", new ApiError({ status: 400, errorCode: "PAYMENT_AMOUNT_MISMATCH" }))).toBe(
      "errorPaymentAmountMismatch",
    );
    expect(errorText(t, "en", new ApiError({ status: 409, errorCode: "ORDER_CLOSED" }))).toBe("errorOrderClosed");
  });

  it("결제 거절: 한국어 화면엔 토스의 구체적인 안내(한도 초과 등)를, 다른 언어엔 일반 문구를 보여준다", () => {
    const error = new ApiError({ status: 400, errorCode: "PAYMENT_REJECTED", message: "카드 한도가 초과되었습니다." });
    expect(errorText(t, "ko", error)).toBe("카드 한도가 초과되었습니다.");
    expect(errorText(t, "ja", error)).toBe("errorPaymentRejected");
  });

  it("ApiError 가 아닌 예외(코드 버그 등)는 일반 문장으로만 보여준다", () => {
    expect(errorText(t, "ko", new TypeError("x is undefined"))).toBe("errorUnknown");
  });
});
