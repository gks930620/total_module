// 내 명함 목록 — 로그인 후의 홈.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../lib/I18nProvider.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCards } from "../context/CardsContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { api } from "../lib/api.js";
import { errorText } from "../lib/errorText.js";
import { AppBar, AppBarAction, Page } from "../components/AppShell.jsx";
import { ActionSheet, ConfirmDialog } from "../components/Overlays.jsx";
import { CardAvatar } from "../components/CardBits.jsx";
import { EmptyState, ErrorState, SkeletonRows } from "../components/States.jsx";
import Icon from "../components/Icon.jsx";
import LanguageSelect from "../components/LanguageSelect.jsx";
import InstallPrompt from "../components/InstallPrompt.jsx";
import LegalFooter from "../components/LegalFooter.jsx";

export default function CardListPage() {
  const { t, lang } = useI18n();
  const { entitlement, logout, markGuest } = useAuth();
  const { cards, loaded, hasMore, loadMore } = useCards();
  const toast = useToast();
  const navigate = useNavigate();

  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // "logout" | "deleteAccount"
  const [busy, setBusy] = useState(false);
  const sentinel = useRef(null);

  // 처음 들어올 때만 1페이지를 받는다. 이미 받아 둔 게 있으면 다시 받지 않는다(CardsContext 참고).
  useEffect(() => {
    if (!loaded) loadMore().catch(setError);
  }, [loaded, loadMore]);

  // 무한스크롤 — 목록 끝의 표시가 화면에 들어오면 다음 페이지.
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || !loaded) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          setLoadingMore(true);
          loadMore()
            .catch((e) => toast(t("cardsLoadFailed", { error: errorText(t, lang, e) }), "err"))
            .finally(() => setLoadingMore(false));
        }
      },
      // 바닥에 닿기 전에 미리 받는다 — 사용자가 빈 공간을 보며 기다리지 않게.
      { rootMargin: "200px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loaded, loadingMore, loadMore, toast, t, lang]);

  const limit = entitlement?.card_limit; // 없으면(undefined) 무제한 = 프로
  const count = entitlement?.card_count ?? cards.length;
  const atLimit = typeof limit === "number" && count >= limit;

  // 한도가 찼으면 폼을 다 채운 뒤 거절하지 말고, 먼저 프로 화면으로 안내한다.
  // (서버도 등록 시 한 번 더 막는다 — 이건 사용 흐름을 위한 앞단 검사일 뿐이다)
  const addTarget = atLimit ? "/pro?limit=1" : "/cards/new";

  const subtitle =
    typeof limit === "number" ? t("cardCountUsage", { used: count, limit }) : t("cardsShareSubtitle", { count });

  async function runConfirmed() {
    setBusy(true);
    try {
      if (confirm === "logout") {
        await logout();
        navigate("/", { replace: true });
      } else if (confirm === "deleteAccount") {
        await api.deleteAccount();
        toast(t("deleteAccountSucceeded"), "ok");
        markGuest();
        navigate("/", { replace: true });
      }
    } catch (e) {
      const key = confirm === "logout" ? "logoutFailed" : "deleteAccountFailed";
      toast(t(key, { error: errorText(t, lang, e) }), "err");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <Page
      appBar={
        <AppBar
          title={t("myCards")}
          brand
          actions={
            <>
              <AppBarAction icon="sparkle" label={entitlement?.pro ? t("proActive") : t("upgradeToPro")} to="/pro" />
              <AppBarAction icon="more" label={t("menuAccount")} onClick={() => setMenuOpen(true)} />
            </>
          }
        />
      }
    >
      <section className="k-app-hero bq-list-hero">
        <h1>{t("myCards")}</h1>
        <p>{loaded ? subtitle : t("statusLoading")}</p>
      </section>

      <InstallPrompt />

      {!loaded && !error && <SkeletonRows count={3} />}
      {error && <ErrorState error={error} onRetry={() => { setError(null); loadMore().catch(setError); }} />}

      {loaded && cards.length === 0 && (
        <EmptyState
          title={t("emptyCardsTitle")}
          body={t("emptyCardsBody")}
          action={
            <Link className="k-btn k-btn--primary" to={addTarget}>
              <Icon name="plus" size={18} />
              <span>{t("addCard")}</span>
            </Link>
          }
        />
      )}

      {cards.length > 0 && (
        <ul className="k-list bq-plain-list">
          {cards.map((card) => (
            <li key={card.id}>
              {/* 킷의 .k-item__title/__sub 는 블록 요소에 쓰는 전제다 — span 으로 두면 한 줄로 붙는다 */}
              <Link className="k-item" to={`/cards/${card.id}`}>
                <div className="k-item__icon bq-item-thumb">
                  <CardAvatar card={card} />
                </div>
                <div className="k-item__main">
                  <div className="k-item__title">{card.full_name}</div>
                  <div className="k-item__sub">
                    {[card.title, card.organization].filter(Boolean).join(" · ") || card.phone || card.email || " "}
                  </div>
                </div>
                <span className="k-item__chevron" aria-hidden="true">
                  <Icon name="chevronRight" size={18} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasMore && loaded && <div ref={sentinel} aria-hidden="true">{loadingMore && <SkeletonRows count={1} />}</div>}

      {/* 빈 목록일 땐 가운데 버튼이 있으니 FAB 를 겹쳐 띄우지 않는다(주 동작은 화면당 하나) */}
      {loaded && cards.length > 0 && (
        <Link className="k-fab" to={addTarget} aria-label={t("addCard")} title={t("addCard")}>
          <Icon name="plus" size={26} />
        </Link>
      )}

      {menuOpen && (
        <ActionSheet title={t("menuAccount")} onClose={() => setMenuOpen(false)}>
          <div className="k-list k-list--plain">
            <Link className="k-item" to="/pro" onClick={() => setMenuOpen(false)}>
              <span className="k-item__icon bq-item-icon"><Icon name="sparkle" size={18} /></span>
              <span className="k-item__main"><span className="k-item__title">{entitlement?.lifetime ? t("proLifetimeActive") : entitlement?.pro ? t("proActive") : t("upgradeToPro")}</span></span>
            </Link>
            <button type="button" className="k-item bq-item-button" onClick={() => { setMenuOpen(false); setConfirm("logout"); }}>
              <span className="k-item__icon bq-item-icon"><Icon name="logout" size={18} /></span>
              <span className="k-item__main"><span className="k-item__title">{t("actionLogout")}</span></span>
            </button>
            <button type="button" className="k-item bq-item-button bq-danger-text" onClick={() => { setMenuOpen(false); setConfirm("deleteAccount"); }}>
              <span className="k-item__icon bq-item-icon"><Icon name="userX" size={18} /></span>
              <span className="k-item__main"><span className="k-item__title">{t("deleteAccountAction")}</span></span>
            </button>
          </div>
          <div className="bq-sheet-section">
            <LanguageSelect />
          </div>
          <LegalFooter withBusinessInfo={false} />
        </ActionSheet>
      )}

      {confirm === "logout" && (
        <ConfirmDialog
          title={t("actionLogout")}
          message={t("logoutConfirmMessage")}
          confirmLabel={t("actionLogout")}
          busy={busy}
          onConfirm={runConfirmed}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "deleteAccount" && (
        <ConfirmDialog
          title={t("deleteAccountTitle")}
          message={
            // 평생 이용권을 산 사람에겐 "탈퇴 = 환불 아님"을 누르기 전에 알린다(약관 제9조)
            entitlement?.lifetime
              ? `${t("deleteAccountMessage")} ${t("deleteAccountLifetimeWarning")}`
              : t("deleteAccountMessage")
          }
          confirmLabel={t("deleteAccountConfirm")}
          danger
          busy={busy}
          onConfirm={runConfirmed}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Page>
  );
}
