// 토스페이먼츠 결제창(SDK v2 "결제창") 연동 — 설계 businesscard_qr/설계/웹결제_설계.md.
//
// 흐름: 서버가 주문을 만든다(금액도 서버가 정한다) → 여기서 결제창을 연다 →
//      토스가 /pro/success 또는 /pro/fail 로 돌려보낸다 → 성공 화면이 서버에 승인을 요청한다.
// 결제창을 연 것만으로는 돈이 빠지지 않는다. 서버가 승인해야 결제가 끝난다.

/** SDK 주소. CSP(SecurityConfig) 가 이 주소 하나만 허용한다 — 바꾸면 거기도 고친다. */
export const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";

/** 결제창에 넘길 값. 서버가 만든 주문을 그대로 옮긴다 — 금액을 화면에서 계산하지 않는다. */
export function paymentRequest(order, origin) {
  return {
    method: "CARD",
    amount: { currency: order.currency, value: order.amount },
    orderId: order.order_id,
    orderName: order.order_name,
    successUrl: `${origin}/pro/success`,
    failUrl: `${origin}/pro/fail`,
    card: {
      useEscrow: false,
      // 카드사·간편결제를 고르는 기본 결제창
      flowMode: "DEFAULT",
      useCardPoint: false,
      useAppCardOnly: false,
    },
  };
}

/**
 * 성공 주소(/pro/success?paymentKey=…&orderId=…&amount=…)에서 승인에 필요한 값을 꺼낸다.
 * 하나라도 빠졌거나 금액이 양의 정수가 아니면 null — 그때는 승인 요청을 보내지 않는다.
 * (금액이 맞는지는 서버가 주문 금액과 비교한다. 여기서는 형식만 본다)
 */
export function readSuccessParams(searchParams) {
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const rawAmount = searchParams.get("amount");
  const amount = rawAmount === null || rawAmount === "" ? NaN : Number(rawAmount);
  if (!paymentKey || !orderId || !Number.isSafeInteger(amount) || amount <= 0) return null;
  return { orderId, paymentKey, amount };
}

/**
 * 실패 주소(/pro/fail?code=…&message=…)의 코드 → 화면 문구 키.
 * 토스의 message 는 한국어 고정이라 쓰지 않고 코드로 고른다.
 */
export function failReasonKey(code) {
  switch (code) {
    case "PAY_PROCESS_CANCELED": // 사용자가 결제창을 닫았다
      return "payCanceled";
    case "PAY_PROCESS_ABORTED": // 진행 중 오류로 멈췄다
      return "payAborted";
    case "REJECT_CARD_COMPANY": // 카드사가 거절했다(한도·정지 등)
      return "payRejectedByCard";
    default:
      return "payFailed";
  }
}

let sdkLoading = null;

/**
 * 토스 SDK 를 결제 버튼을 누를 때만 싣는다 — 프로 화면 밖에서는 외부 스크립트를 받지 않는다.
 * 실패하면 다음 시도에서 다시 받는다(일시적인 네트워크 오류로 영영 못 쓰게 되지 않도록).
 */
export function loadTossSdk(doc = document) {
  if (globalThis.TossPayments) return Promise.resolve(globalThis.TossPayments);
  if (!sdkLoading) {
    sdkLoading = new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.src = TOSS_SDK_URL;
      script.async = true;
      script.onload = () => {
        if (globalThis.TossPayments) resolve(globalThis.TossPayments);
        else reject(new Error("TossPayments SDK did not initialise"));
      };
      script.onerror = () => {
        sdkLoading = null;
        script.remove();
        reject(new Error("TossPayments SDK failed to load"));
      };
      doc.head.appendChild(script);
    });
  }
  return sdkLoading;
}

/**
 * 결제창을 연다. 모바일은 토스 결제 페이지로 이동하고, PC 는 화면 위에 결제창이 뜬다.
 * 끝나면(성공·실패·취소 모두) 토스가 successUrl / failUrl 로 돌려보낸다.
 */
export async function openPaymentWindow(order, origin = window.location.origin) {
  const TossPayments = await loadTossSdk();
  // 비회원 결제 — 토스에 우리 회원 식별자를 넘기지 않는다. 주문 ↔ 회원 연결은 우리 DB 가 안다.
  const payment = TossPayments(order.client_key).payment({ customerKey: TossPayments.ANONYMOUS });
  return payment.requestPayment(paymentRequest(order, origin));
}
