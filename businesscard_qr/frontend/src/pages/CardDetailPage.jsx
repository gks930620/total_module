// 내 명함 상세 — 공유(링크·QR·vCard)가 이 화면의 주 목적이다.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../lib/I18nProvider.jsx";
import { useCards } from "../context/CardsContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { api, publicVcfUrl } from "../lib/api.js";
import { errorText } from "../lib/errorText.js";
import { cardShareUrl } from "../lib/shareLink.js";
import { mailtoHref, mapHref, telHref, websiteHref } from "../lib/contactLinks.js";
import { AppBar, AppBarAction, Page } from "../components/AppShell.jsx";
import { ConfirmDialog } from "../components/Overlays.jsx";
import { CardAvatar, InfoRow, QrCode } from "../components/CardBits.jsx";
import { ErrorState, SkeletonRows } from "../components/States.jsx";
import Icon from "../components/Icon.jsx";

export default function CardDetailPage() {
  const { cardId } = useParams();
  const { t, lang, formatDate } = useI18n();
  const { find, removed } = useCards();
  const toast = useToast();
  const navigate = useNavigate();

  const [card, setCard] = useState(() => find(cardId));
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 캐시에 있으면 그대로 보여주되, 링크로 바로 들어왔으면(캐시 없음) 받아 온다.
  useEffect(() => {
    if (card) return;
    api.getCard(cardId).then(setCard).catch(setError);
  }, [card, cardId, attempt]);

  // 수정하고 돌아오면 캐시가 바뀐다 — 그걸 따라간다.
  const fromCache = find(cardId);
  useEffect(() => {
    if (fromCache && fromCache !== card) setCard(fromCache);
  }, [fromCache, card]);

  const shareUrl = cardShareUrl(window.location.origin, cardId);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast(t("linkCopied"), "ok");
    } catch {
      // http(비보안) 환경이나 권한 거부 — 링크는 화면에 보이니 직접 복사하게 안내한다.
      toast(t("copyFailed"), "err");
    }
  }

  async function shareNative() {
    try {
      await navigator.share({ title: t("shareText", { name: card.full_name }), url: shareUrl });
    } catch (e) {
      // 사용자가 공유 창을 닫은 건 오류가 아니다.
      if (e?.name !== "AbortError") copyLink();
    }
  }

  async function onDelete() {
    setDeleting(true);
    try {
      await api.deleteCard(cardId);
      removed(cardId);
      toast(t("cardDeleted"), "ok");
      navigate("/cards", { replace: true });
    } catch (e) {
      toast(t("deleteCardFailed", { error: errorText(t, lang, e) }), "err");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const appBar = (
    <AppBar
      title={card?.full_name ?? ""}
      back="/cards"
      actions={card && <AppBarAction icon="edit" label={t("actionEdit")} to={`/cards/${cardId}/edit`} />}
    />
  );

  if (error) {
    return (
      <Page appBar={appBar}>
        <ErrorState error={error} onRetry={() => { setError(null); setAttempt((n) => n + 1); }} />
      </Page>
    );
  }
  if (!card) {
    return (
      <Page appBar={appBar}>
        <SkeletonRows count={4} />
      </Page>
    );
  }

  const subtitle = [card.title, card.organization].filter(Boolean).join(" · ");
  const canShareNatively = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Page appBar={appBar}>
      {card.business_card_image_url && (
        <img className="bq-card-image" src={card.business_card_image_url} alt={t("sectionCardImage")} />
      )}
      <div className="k-card bq-identity">
        {/* 사진이 위에 크게 있으면 같은 사진을 썸네일로 또 띄우지 않는다 */}
        {!card.business_card_image_url && <CardAvatar card={card} size="lg" />}
        <div>
          <h2 className="bq-identity-name">{card.full_name}</h2>
          {subtitle && <p className="k-muted">{subtitle}</p>}
        </div>
      </div>

      {/* ── 공유 — 이 화면의 주 동작 ── */}
      <section className="k-card k-stack" aria-labelledby="share-title">
        <h2 id="share-title" className="bq-section-title">{t("shareLinkTitle")}</h2>
        <p className="k-muted">{t("shareLinkBody")}</p>
        <div className="k-inputgroup">
          <input className="k-input bq-mono-input" value={shareUrl} readOnly aria-label={t("shareLinkTitle")}
            onFocus={(event) => event.target.select()} />
          <button type="button" className="k-btn k-btn--secondary" onClick={copyLink}>
            <Icon name="copy" size={18} />
            <span>{t("copyLink")}</span>
          </button>
        </div>
        {canShareNatively && (
          <button type="button" className="k-btn k-btn--primary k-btn--block" onClick={shareNative}>
            <Icon name="share" size={18} />
            <span>{t("shareAction")}</span>
          </button>
        )}
      </section>

      <section className="k-card k-stack bq-center" aria-labelledby="qr-title">
        <h2 id="qr-title" className="bq-section-title">{t("qrTitle")}</h2>
        <p className="k-muted">{t("qrBody")}</p>
        <QrCode url={shareUrl} downloadName={`${card.full_name || "card"}-qr`} />
        <a className="k-btn k-btn--ghost k-btn--sm" href={publicVcfUrl(cardId)} download>
          <Icon name="userPlus" size={18} />
          <span>{t("downloadVcf")}</span>
        </a>
      </section>

      {/* ── 정보 ── */}
      <section className="k-list" aria-label={t("sectionBasicInfo")}>
        <InfoRow icon="phone" label={t("fieldPhone")} value={card.phone} href={telHref(card.phone)} />
        <InfoRow icon="mail" label={t("fieldEmail")} value={card.email} href={mailtoHref(card.email)} />
        <InfoRow icon="globe" label={t("fieldWebsite")} value={card.website} href={websiteHref(card.website)} external />
        <InfoRow icon="building" label={t("labelCompany")} value={card.organization} />
        <InfoRow icon="mapPin" label={t("fieldAddress")} value={card.address} href={mapHref(card.address, lang)} external />
        <InfoRow icon="note" label={t("fieldNote")} value={card.note} />
      </section>

      <p className="k-muted bq-center">
        {t("viewCount", { count: card.view_count ?? 0 })}
        {card.created_at && <> · {t("createdOn", { date: formatDate(card.created_at) })}</>}
      </p>

      <div className="k-flex bq-detail-actions">
        <Link className="k-btn k-btn--secondary" to={`/cards/${cardId}/edit`}>
          <Icon name="edit" size={18} />
          <span>{t("actionEdit")}</span>
        </Link>
        <button type="button" className="k-btn k-btn--danger" onClick={() => setConfirmDelete(true)}>
          <Icon name="trash" size={18} />
          <span>{t("actionDelete")}</span>
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t("deleteCardTitle")}
          message={t("deleteCardMessage", { name: card.full_name })}
          confirmLabel={t("actionDelete")}
          danger
          busy={deleting}
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Page>
  );
}
