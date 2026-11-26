// 토스 결제창 연동의 순수 로직 — 결제창에 넘길 값, 돌아온 주소 읽기, 실패 사유.
// 금액·주문번호가 하나만 어긋나도 돈이 잘못 나가거나 승인이 거절된다.
import { describe, it, expect } from "vitest";
import { failReasonKey, paymentRequest, readSuccessParams } from "../payment.js";

const ORDER = {
  order_id: "bq_abc123",
  order_name: "명함QR 프로 평생 이용권",
  product_id: "pro_lifetime",
  amount: 9900,
  currency: "KRW",
  client_key: "test_ck_x",
};

describe("paymentRequest", () => {
  it("서버가 만든 주문 그대로 결제창에 넘긴다 — 금액을 화면에서 정하지 않는다", () => {
    expect(paymentRequest(ORDER, "https://card.example.com")).toEqual({
      method: "CARD",
      amount: { currency: "KRW", value: 9900 },
      orderId: "bq_abc123",
      orderName: "명함QR 프로 평생 이용권",
      successUrl: "https://card.example.com/pro/success",
      failUrl: "https://card.example.com/pro/fail",
      card: { useEscrow: false, flowMode: "DEFAULT", useCardPoint: false, useAppCardOnly: false },
    });
  });

  it("클라이언트 키는 SDK 초기화에만 쓰고 결제 요청 본문에는 싣지 않는다", () => {
    expect(JSON.stringify(paymentRequest(ORDER, "https://x"))).not.toContain("test_ck_x");
  });
});

describe("readSuccessParams", () => {
  it("토스가 성공 주소에 붙여 준 값을 꺼낸다", () => {
    const params = new URLSearchParams("paymentType=NORMAL&orderId=bq_1&paymentKey=pk_1&amount=9900");
    expect(readSuccessParams(params)).toEqual({ orderId: "bq_1", paymentKey: "pk_1", amount: 9900 });
  });

  it("값이 빠졌거나 금액이 올바른 정수가 아니면 null — 승인 요청을 보내지 않는다", () => {
    expect(readSuccessParams(new URLSearchParams("orderId=bq_1&amount=9900"))).toBeNull();
    expect(readSuccessParams(new URLSearchParams("paymentKey=pk&amount=9900"))).toBeNull();
    expect(readSuccessParams(new URLSearchParams("orderId=bq_1&paymentKey=pk&amount=abc"))).toBeNull();
    expect(readSuccessParams(new URLSearchParams("orderId=bq_1&paymentKey=pk&amount=-1"))).toBeNull();
    expect(readSuccessParams(new URLSearchParams("orderId=bq_1&paymentKey=pk&amount=99.5"))).toBeNull();
    expect(readSuccessParams(new URLSearchParams(""))).toBeNull();
  });
});

describe("failReasonKey", () => {
  it("토스 실패 코드를 화면 문구로 바꾼다", () => {
    expect(failReasonKey("PAY_PROCESS_CANCELED")).toBe("payCanceled");
    expect(failReasonKey("PAY_PROCESS_ABORTED")).toBe("payAborted");
    expect(failReasonKey("REJECT_CARD_COMPANY")).toBe("payRejectedByCard");
  });

  it("모르는 코드·코드 없음은 일반 문구 — 토스의 한국어 문장을 다른 언어 화면에 내보내지 않는다", () => {
    expect(failReasonKey("SOMETHING_NEW")).toBe("payFailed");
    expect(failReasonKey(null)).toBe("payFailed");
  });
});
