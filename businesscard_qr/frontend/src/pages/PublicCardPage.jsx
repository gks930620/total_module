// 공개 명함 — 링크·QR 을 받은 사람이 보는 화면. 이 전환의 핵심이다(설계 §4).
//
// 받는 사람은 앱도 계정도 없다. 그래서:
//   - 로그인 여부를 묻지 않는다(첫 화면을 늦출 이유가 없다)
//   - "연락처에 저장" 한 번이면 끝나게 한다 — 이게 이 화면의 유일한 주 동작이다
//   - 남이 입력한 값을 링크로 만들 땐 반드시 contactLinks.js 를 거친다(javascript: 차단)
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../lib/I18nProvider.jsx";
import { api, publicVcfUrl } from "../lib/api.js";
import { mailtoHref, mapHref, telHref, websiteHref } from "../lib/contactLinks.js";
import { CardAvatar, InfoRow } from "../components/CardBits.jsx";
import { EmptyState, ErrorState, SkeletonRows } from "../components/States.jsx";
import Icon from "../components/Icon.jsx";
import LanguageSelect from "../components/LanguageSelect.jsx";

/** 같은 사람이 새로고침할 때마다 조회수가 오르지 않게, 이번 방문(탭) 동안 한 번만 센다. */
function countViewOnce(cardId) {
  const key = `bq.viewed.${cardId}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // 저장소를 못 쓰면 매번 센다 — 조회수가 조금 부풀 뿐, 기능엔 지장 없다
  }
  api.countView(cardId).catch(() => {}); // 조회수 실패로 명함 보기를 방해하지 않는다
}

export default function PublicCardPage() {
  const { cardId } = useParams();
  const { t, lang } = useI18n();
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    api
      .publicCard(cardId)
      .then((data) => {
        setCard(data);
        countViewOnce(cardId);
      })
      .catch(setError);
  }, [cardId, attempt]);

  useEffect(() => {
    // 공유 미리보기(카톡·슬랙)는 서버 HTML 의 og 태그를 읽어 여기 영향은 없지만,
    // 탭 제목만이라도 "누구의 명함"인지 보이게 한다.
    if (card?.full_name) document.title = t("shareText", { name: card.full_name });
  }, [card, t]);

  const notFound = error?.status === 404;

  return (
    <div className="k-app">
      <main className="k-app-main bq-public">
        <div className="bq-column k-stack">
          <div className="bq-public-top">
            <span className="k-muted">{t("appTitle")}</span>
            <LanguageSelect compact />
          </div>

          {!card && !error && <SkeletonRows count={4} />}

          {notFound && (
            <EmptyState
              title={t("publicNotFoundTitle")}
              body={t("publicNotFoundBody")}
              action={<Link className="k-btn k-btn--secondary" to="/">{t("publicMakeYourOwn")}</Link>}
            />
          )}
          {error && !notFound && <ErrorState error={error} onRetry={() => { setError(null); setAttempt((n) => n + 1); }} />}

          {card && (
            <>
              <section className="k-hero bq-public-hero">
                {card.business_card_image_url ? (
                  <img className="bq-card-image bq-card-image--hero" src={card.business_card_image_url} alt="" />
                ) : (
                  <CardAvatar card={card} size="xl" />
                )}
                <h1>{card.full_name}</h1>
                {(card.title || card.organization) && (
                  <p>{[card.title, card.organization].filter(Boolean).join(" · ")}</p>
                )}
              </section>

              {/* 이 화면의 주 동작. iOS 사파리는 .vcf 를 열면 바로 "연락처에 추가" 화면을 띄운다. */}
              <a className="k-btn k-btn--primary k-btn--lg k-btn--block" href={publicVcfUrl(card.id)} download>
                <Icon name="userPlus" size={20} />
                <span>{t("publicSaveContact")}</span>
              </a>
              <p className="k-muted bq-center">{t("publicSaveContactHint")}</p>

              <section className="k-list" aria-label={t("sectionContactInfo")}>
                <InfoRow icon="phone" label={t("publicCall")} value={card.phone} href={telHref(card.phone)} />
                <InfoRow icon="mail" label={t("publicEmail")} value={card.email} href={mailtoHref(card.email)} />
                <InfoRow icon="globe" label={t("publicWebsite")} value={card.website} href={websiteHref(card.website)} external />
                <InfoRow icon="mapPin" label={t("publicMap")} value={card.address} href={mapHref(card.address, lang)} external />
                <InfoRow icon="note" label={t("fieldNote")} value={card.note} />
              </section>

              <footer className="bq-public-footer k-stack bq-center">
                <span className="k-muted">{t("publicPoweredBy")}</span>
                <Link className="k-btn k-btn--ghost k-btn--sm" to="/">{t("publicMakeYourOwn")}</Link>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
