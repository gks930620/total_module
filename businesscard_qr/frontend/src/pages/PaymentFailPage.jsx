// 결제 실패 주소(/pro/fail?code=…&message=…) — 결제창에서 취소했거나 카드사가 거절한 경우.
// 여기로 오는 건 언제나 "승인 전"이다 — 돈은 빠져나가지 않았다.
// 토스의 message 는 한국어 고정이라 화면에 그대로 찍지 않고, code 로 문구를 고른다(주소창 값을 화면에 비추지도 않는다).
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../lib/I18nProvider.jsx";
import { AppBar, Page } from "../components/AppShell.jsx";
import { failReasonKey } from "../lib/payment.js";

export default function PaymentFailPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const reasonKey = failReasonKey(params.get("code"));

  return (
    <Page appBar={<AppBar title={t("proTitle")} back="/pro" />}>
      <section className="k-hero bq-result">
        <h1>{t("payFailedTitle")}</h1>
        <p>{t(reasonKey)}</p>
      </section>
      <div className="k-alert k-alert--ok" role="status">{t("payNotCharged")}</div>
      <Link className="k-btn k-btn--primary k-btn--lg k-btn--block" to="/pro">{t("payTryAgain")}</Link>
      <Link className="k-btn k-btn--secondary k-btn--block" to="/cards">{t("goToMyCards")}</Link>
    </Page>
  );
}
