// 결제 API 의 경로·본문 — 백엔드 WebCheckoutController 계약과 1:1 이다(설계 웹결제_설계.md §3).
// 이름 하나만 어긋나도 서버는 "payment_key 는 필수입니다" 로 거절하고, 사용자는 돈만 묶인 채 프로가 안 된다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../http.js";
import { api } from "../api.js";

vi.mock("../http.js", () => ({ request: vi.fn(async () => null) }));

describe("결제 API", () => {
  beforeEach(() => request.mockClear());

  it("가격 조회", async () => {
    await api.lifetimeOffer();
    expect(request).toHaveBeenCalledWith("/api/billing/web/lifetime");
  });

  it("주문 생성은 본문 없이 POST — 금액은 서버가 정한다", async () => {
    await api.createLifetimeOrder();
    expect(request).toHaveBeenCalledWith("/api/billing/web/orders", { method: "POST" });
  });

  it("승인 요청: 본문은 snake_case, 주문번호는 인코딩해 경로에 넣는다", async () => {
    await api.confirmPayment("bq/../x", "pk_1", 9900);
    expect(request).toHaveBeenCalledWith("/api/billing/web/orders/bq%2F..%2Fx/confirm", {
      method: "POST",
      body: { payment_key: "pk_1", amount: 9900 },
    });
  });
});
