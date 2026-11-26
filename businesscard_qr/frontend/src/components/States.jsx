// 로딩·빈 상태·오류 상태. 화면마다 따로 만들면 문구와 모양이 조금씩 달라진다.
import { useI18n } from "../lib/I18nProvider.jsx";
import { errorText } from "../lib/errorText.js";

export function FullPageLoading() {
  const { t } = useI18n();
  return (
    <div className="k-app">
      <main className="k-app-main">
        <div className="bq-column k-stack" aria-busy="true">
          <span className="k-sr">{t("statusLoading")}</span>
          <div className="k-skeleton bq-skeleton-hero" />
          <div className="k-skeleton bq-skeleton-row" />
          <div className="k-skeleton bq-skeleton-row" />
        </div>
      </main>
    </div>
  );
}

export function SkeletonRows({ count = 3 }) {
  const { t } = useI18n();
  return (
    <div className="k-stack" aria-busy="true">
      <span className="k-sr">{t("statusLoading")}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="k-skeleton bq-skeleton-row" />
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="k-empty">
      <h3>{title}</h3>
      {body && <p className="bq-preline">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, fullPage = false }) {
  const { t, lang } = useI18n();
  const content = (
    <div className="k-stack">
      <div className="k-alert k-alert--err" role="alert">
        {errorText(t, lang, error)}
      </div>
      {onRetry && (
        <button type="button" className="k-btn k-btn--secondary" onClick={onRetry}>
          {t("actionRetry")}
        </button>
      )}
    </div>
  );
  if (!fullPage) return content;
  return (
    <div className="k-app">
      <main className="k-app-main">
        <div className="bq-column">{content}</div>
      </main>
    </div>
  );
}
