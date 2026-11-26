// 첫 화면 — 처음 온 사람이 보는 곳. 로그인되어 있으면 바로 목록으로 보낸다.
import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../lib/I18nProvider.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { KAKAO_LOGIN_URL } from "../lib/api.js";
import LanguageSelect from "../components/LanguageSelect.jsx";
import InstallPrompt from "../components/InstallPrompt.jsx";
import LegalFooter from "../components/LegalFooter.jsx";
import { api } from "../lib/api.js";
import { formatPrice } from "../lib/i18n.js";

/**
 * 요금 안내 — 가입 전에도 무엇이 무료이고 무엇이 얼마인지 보여준다(결제대행사 심사도 "가격이 보이는가"를 본다).
 * 값은 서버가 정한다. 못 받아 오면(서버가 깨어나는 중 등) 조용히 숨긴다 — 로그인 버튼이 먼저다.
 */
function Pricing() {
  const { t, lang } = useI18n();
  const [offer, setOffer] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.lifetimeOffer().then(
      (data) => !cancelled && setOffer(data),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!offer) return null;
  return (
    <section className="k-card k-stack bq-pricing" aria-label={t("pricingTitle")}>
      <h2 className="bq-section-title">{t("pricingTitle")}</h2>
      <p>{t("pricingFree", { limit: offer.free_card_limit })}</p>
      {/* 결제가 아직 열리지 않았으면 살 수 없는 상품의 가격을 내걸지 않는다 */}
      {offer.available && <p>{t("pricingLifetime", { price: formatPrice(lang, offer.amount, offer.currency) })}</p>}
    </section>
  );
}

/**
 * 서버가 로그인 실패 시 붙여 보내는 사유(KakaoWebLoginController.toLogin).
 * **정해진 키로만** 바꾼다 — 주소창의 값을 그대로 화면에 찍지 않는다.
 */
const LOGIN_ERRORS = {
  cancelled: "loginErrorCancelled",
  invalid_state: "loginErrorInvalidState",
  failed: "loginErrorFailed",
  not_configured: "loginErrorNotConfigured",
};

export default function LoginPage() {
  const { t } = useI18n();
  const { status, check } = useAuth();
  const [params] = useSearchParams();
  const loginError = LOGIN_ERRORS[params.get("login_error")] ?? (params.has("login_error") ? "loginErrorFailed" : null);

  // 로그인 여부를 확인하는 동안에도 버튼은 바로 보여준다.
  // 서버가 깨어나는 데 수십 초 걸릴 수 있는데, 처음 온 사람을 그동안 빈 화면에 세워 둘 수는 없다.
  useEffect(() => {
    if (status === "unknown") check();
  }, [status, check]);

  if (status === "authed") return <Navigate to="/cards" replace />;

  return (
    <div className="k-app">
      <main className="k-app-main bq-login">
        <div className="bq-column k-stack">
          <section className="k-hero bq-login-hero">
            <img className="bq-login-mark" src="/icons/favicon.svg" alt="" width="64" height="64" />
            <h1>{t("appTitle")}</h1>
            <p>{t("loginTagline")}</p>
          </section>

          {loginError && (
            <div className="k-alert k-alert--err" role="alert">
              {t(loginError)}
            </div>
          )}

          {/* 버튼이 아니라 링크다 — 서버가 카카오로 보내는 302 를 브라우저가 따라가야 한다(fetch 로는 안 된다). */}
          {/* 카카오 디자인 가이드: 노란 바탕(#FEE500) + 검은 말풍선 심볼 + 검은 글자(85%). 색은 :root 토큰(app.css) */}
          <a className="k-btn k-btn--lg k-btn--block bq-kakao" href={KAKAO_LOGIN_URL}>
            <svg className="bq-kakao-symbol" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.71 6.78l-.98 3.6c-.09.32.27.58.55.39l4.3-2.85c.46.05.93.08 1.42.08 5.52 0 10-3.58 10-8S17.52 3 12 3z"
              />
            </svg>
            <span>{t("loginWithKakao")}</span>
          </a>
          <p className="k-muted bq-center">{t("loginKakaoNotice")}</p>

          <InstallPrompt />

          <Pricing />

          <LanguageSelect />

          <LegalFooter />
        </div>
      </main>
    </div>
  );
}
