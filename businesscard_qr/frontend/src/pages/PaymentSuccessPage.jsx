// 결제 성공 주소(/pro/success) — 토스가 결제 인증을 마치고 돌려보내는 곳.
//
// ⚠️ 여기 도착했다고 결제가 끝난 게 아니다. 서버가 토스에 "승인"을 요청해야 돈이 빠지고 이용권이 생긴다.
// 승인 요청 전에 창을 닫으면 토스가 10분 뒤 자동 취소한다(돈이 빠지지 않는다).
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../lib/I18nProvider.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { AppBar, Page } from "../components/AppShell.jsx";
import Icon from "../components/Icon.jsx";
import { api } from "../lib/api.js";
import { CLIENT_ERROR } from "../lib/http.js";
import { errorText } from "../lib/errorText.js";
import { readSuccessParams } from "../lib/payment.js";

/**
 * 같은 결제의 승인 요청은 한 번만 보낸다 — 개발 모드(StrictMode)의 이중 실행이나 화면 재마운트로
 * 요청이 겹치면, 뒤의 요청이 "처리 중"으로 실패해 성공한 결제를 실패처럼 보여줄 수 있다.
 * 실패하면 지워서 "다시 시도"가 새 요청을 보내게 한다. (서버도 같은 결제의 재승인은 한 번만 처리한다)
 */
const confirming = new Map();
function confirmOnce({ orderId, paymentKey, amount }) {
  if (!confirming.has(paymentKey)) {
    const request = api.confirmPayment(orderId, paymentKey, amount).catch((error) => {
      confirming.delete(paymentKey);
      throw error;
    });
    confirming.set(paymentKey, request);
  }
  return confirming.get(paymentKey);
}

/** 다시 눌러 볼 만한 실패인가 — 서버·네트워크 사정이면 그렇고, 금액 불일치·거절 같은 판정이면 아니다. */
const RETRYABLE = new Set([
  "PAYMENT_UNAVAILABLE",
  CLIENT_ERROR.NETWORK,
  CLIENT_ERROR.TIMEOUT,
  CLIENT_ERROR.SERVER_WAKING,
  CLIENT_ERROR.UNKNOWN,
]);

export default function PaymentSuccessPage() {
  const { t, lang } = useI18n();
  const { setEntitlement } = useAuth();
  const [params] = useSearchParams();
  const payment = useMemo(() => readSuccessParams(params), [params]);
  const [state, setState] = useState(() => (payment ? { status: "confirming" } : { status: "invalid" }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!payment) return undefined;
    let cancelled = false;
    setState({ status: "confirming" });
    confirmOnce(payment).then(
      (entitlement) => {
        if (cancelled) return;
        setEntitlement(entitlement);
        setState({ status: "done" });
      },
      (error) => {
        if (!cancelled) setState({ status: "error", error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [payment, attempt, setEntitlement]);

  return (
    <Page appBar={<AppBar title={t("proTitle")} />}>
      {state.status === "confirming" && (
        <section className="k-hero bq-result" aria-busy="true">
          <h1>{t("payConfirming")}</h1>
          <div className="k-skeleton bq-skeleton-row" />
        </section>
      )}

      {state.status === "done" && (
        <>
          <section className="k-hero bq-result">
            <span className="bq-result-mark bq-result-mark--ok" aria-hidden="true"><Icon name="check" size={28} /></span>
            <h1>{t("paySuccessTitle")}</h1>
            <p>{t("paySuccessBody")}</p>
          </section>
          <Link className="k-btn k-btn--primary k-btn--lg k-btn--block" to="/cards/new">{t("addCard")}</Link>
          <Link className="k-btn k-btn--secondary k-btn--block" to="/cards">{t("goToMyCards")}</Link>
        </>
      )}

      {state.status === "error" && (
        <>
          <section className="k-hero bq-result">
            <h1>{t("payConfirmFailedTitle")}</h1>
          </section>
          <div className="k-alert k-alert--err" role="alert">
            <div>
              <strong>{errorText(t, lang, state.error)}</strong>
              <p className="bq-alert-body">{t("payConfirmFailedHint")}</p>
            </div>
          </div>
          {(RETRYABLE.has(state.error?.errorCode) || state.error?.status >= 500) && (
            <button type="button" className="k-btn k-btn--primary k-btn--block" onClick={() => setAttempt((n) => n + 1)}>
              {t("actionRetry")}
            </button>
          )}
          <Link className="k-btn k-btn--secondary k-btn--block" to="/pro">{t("proTitle")}</Link>
        </>
      )}

      {state.status === "invalid" && (
        <>
          <div className="k-alert k-alert--err" role="alert">{t("payInvalidReturn")}</div>
          <Link className="k-btn k-btn--secondary k-btn--block" to="/pro">{t("proTitle")}</Link>
        </>
      )}
    </Page>
  );
}
