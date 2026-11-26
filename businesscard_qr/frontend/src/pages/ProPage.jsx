// 프로 — 평생 이용권(한 번 결제하면 영구). 설계 businesscard_qr/설계/웹결제_설계.md.
//
// 가격은 서버가 정한다(api.lifetimeOffer). 구매 버튼을 누르면 서버가 주문을 만들고(금액 고정)
// 토스 결제창이 열린다. 결과는 /pro/success · /pro/fail 화면이 받는다.
// 결제 키가 아직 없으면(available=false) 누를 수 없는 버튼 대신 "결제는 곧 열려요"를 보여준다.
import { useEffect, useState } from "react";
import { useI18n } from "../lib/I18nProvider.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { AppBar, Page } from "../components/AppShell.jsx";
import { ErrorState } from "../components/States.jsx";
import LegalFooter from "../components/LegalFooter.jsx";
import Icon from "../components/Icon.jsx";
import { api } from "../lib/api.js";
import { ApiError } from "../lib/http.js";
import { errorText } from "../lib/errorText.js";
import { formatPrice } from "../lib/i18n.js";
import { legalDocUrl } from "../lib/legal.js";
import { isAtCardLimit } from "../lib/limits.js";
import { openPaymentWindow } from "../lib/payment.js";

function Benefit({ children }) {
  return (
    <div className="k-flex bq-benefit">
      <span className="bq-item-icon" aria-hidden="true"><Icon name="check" size={18} /></span>
      <span>{children}</span>
    </div>
  );
}

export default function ProPage() {
  const { t, lang, formatDate } = useI18n();
  const { entitlement, refreshEntitlement } = useAuth();
  const toast = useToast();
  const [offer, setOffer] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [buying, setBuying] = useState(false);

  // 다른 기기·탭에서 산 이용권도 바로 보여야 한다 — 들어올 때마다 최신으로 묻는다.
  // (check 가 아니라 refreshEntitlement — 이유는 AuthContext 주석 참고)
  useEffect(() => {
    refreshEntitlement();
  }, [refreshEntitlement]);

  useEffect(() => {
    let cancelled = false;
    setOffer({ status: "loading" });
    api.lifetimeOffer().then(
      (data) => !cancelled && setOffer({ status: "ready", data }),
      (error) => !cancelled && setOffer({ status: "error", error }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const isPro = Boolean(entitlement?.pro);
  const isLifetime = Boolean(entitlement?.lifetime);
  const limit = entitlement?.card_limit;
  const count = entitlement?.card_count ?? 0;
  // 경고는 실제 사용량으로만 판단한다. 주소의 ?limit=1 은 "어디서 왔는지"일 뿐 — 그것만 보고 경고하면
  // 다른 탭에서 명함을 지운 뒤나 북마크로 들어와도 "다 썼어요"가 뜬다(QA 2026-11-26 결함 3).
  // (한도가 차서 여기로 보내졌다면 들어올 때 자격을 새로 받으므로 실제 사용량에도 바로 반영된다)
  const limitReached = isAtCardLimit(entitlement);
  const freeLimit = typeof limit === "number" ? limit : offer.data?.free_card_limit;
  const price = offer.data ? formatPrice(lang, offer.data.amount, offer.data.currency) : "";

  async function buy() {
    if (buying) return;
    setBuying(true);
    try {
      const order = await api.createLifetimeOrder();
      // 모바일은 여기서 토스 결제 페이지로 떠난다. PC 는 결제창이 뜨고, 끝나면 토스가 결과 주소로 보낸다.
      await openPaymentWindow(order);
    } catch (error) {
      if (error instanceof ApiError) {
        toast(errorText(t, lang, error), "err");
        // 다른 탭·기기에서 이미 샀다 — 화면을 최신 상태로 바꾼다.
        if (error.errorCode === "ALREADY_LIFETIME") refreshEntitlement();
      } else if (error?.code !== "USER_CANCEL") {
        // SDK 를 못 받았거나(네트워크·차단) 결제창이 열리지 않았다. 사용자가 닫은 것(USER_CANCEL)은 조용히 넘긴다.
        toast(t("proPaymentWindowFailed"), "err");
      }
    } finally {
      setBuying(false);
    }
  }

  let heroBody;
  if (isLifetime) heroBody = t("proLifetimeActiveBody");
  else if (isPro && entitlement?.expires_at) heroBody = t("proExpiresOn", { date: formatDate(entitlement.expires_at) });
  else if (isPro) heroBody = t("proBenefitUnlimited");
  else if (typeof limit === "number") heroBody = t("cardCountUsage", { used: count, limit });
  else heroBody = t("proFreePlan");

  return (
    <Page appBar={<AppBar title={t("proTitle")} back="/cards" />}>
      <section className="k-hero">
        <h1>{isLifetime ? t("proLifetimeActive") : isPro ? t("proActive") : t("proFreePlan")}</h1>
        <p>{heroBody}</p>
      </section>

      {!isPro && limitReached && typeof limit === "number" && (
        // .k-alert 는 flex 라 제목·본문을 그대로 넣으면 좌우로 나란히 선다 — 한 덩어리로 묶는다
        <div className="k-alert k-alert--warn" role="status">
          <div>
            <strong>{t("cardLimitReachedTitle", { limit })}</strong>
            <p className="bq-alert-body">{t("cardLimitReachedBody")}</p>
          </div>
        </div>
      )}

      <section className="k-card k-stack">
        <h2 className="bq-section-title">{t("proLifetimeTitle")}</h2>
        <Benefit>{t("proBenefitUnlimited")}</Benefit>
        <Benefit>{t("proBenefitLifetime")}</Benefit>

        {!isPro && offer.status === "loading" && <div className="k-skeleton bq-skeleton-row" aria-busy="true" />}
        {!isPro && offer.status === "error" && (
          <ErrorState error={offer.error} onRetry={() => setAttempt((n) => n + 1)} />
        )}
        {!isPro && offer.status === "ready" && offer.data.available && (
          <>
            <p className="bq-price">
              <strong>{price}</strong>
              <span className="k-muted">{t("proPriceOnce")}</span>
            </p>
            <button
              type="button"
              className="k-btn k-btn--primary k-btn--lg k-btn--block"
              onClick={buy}
              disabled={buying}
              aria-busy={buying}
            >
              {buying ? t("proOpeningPayment") : t("proBuyAction", { price })}
            </button>
            {/* 청약철회 제한 사유는 결제 "전에" 알려야 효력이 있다(전자상거래법 제17조 제6항) */}
            <p className="k-help bq-fineprint">
              {t("proRefundNotice", { limit: freeLimit })}{" "}
              {/* 앱 언어의 환불 조항으로 바로 간다 */}
              <a href={legalDocUrl("/terms.html", lang, "refund")}>{t("legalTerms")}</a>
            </p>
            <p className="k-help bq-fineprint">{t("proPaymentNotice")}</p>
          </>
        )}
      </section>

      {!isPro && offer.status === "ready" && !offer.data.available && (
        <div className="k-alert" role="status">
          <div>
            <strong>{t("proComingSoonTitle")}</strong>
            <p className="bq-alert-body">{t("proComingSoonBody", { limit: freeLimit })}</p>
          </div>
        </div>
      )}

      <LegalFooter />
    </Page>
  );
}
