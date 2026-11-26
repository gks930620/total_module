// 앱형 화면 골격 — 디자인 킷의 모바일 셸(.k-app / .k-appbar / .k-app-main)을 그대로 쓴다.
// 데스크톱에선 가운데 칼럼(.bq-column)으로 묶어, 폰 앱을 1920px 로 늘린 듯한 모양을 피한다.
import { Link, useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useI18n } from "../lib/I18nProvider.jsx";

/**
 * @param back  뒤로 갈 경로. true 면 브라우저 뒤로가기(history), 문자열이면 그 경로로.
 *              공유 링크로 바로 들어온 사람에겐 history 가 없으니, 가능하면 경로를 준다.
 */
export function AppBar({ title, back, actions, brand = false }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <header className="k-appbar">
      <div className="bq-column k-flex bq-appbar-row">
        {back === true && (
          <button type="button" className="k-appbar__back" onClick={() => navigate(-1)} aria-label={t("actionBack")}>
            <Icon name="back" />
          </button>
        )}
        {typeof back === "string" && (
          <Link className="k-appbar__back" to={back} aria-label={t("actionBack")}>
            <Icon name="back" />
          </Link>
        )}
        <h1 className={`k-appbar__title${brand ? " k-appbar__title--brand" : ""}`}>{title}</h1>
        {actions}
      </div>
    </header>
  );
}

export function AppBarAction({ icon, label, onClick, to }) {
  if (to) {
    return (
      <Link className="k-appbar__action" to={to} aria-label={label} title={label}>
        <Icon name={icon} />
      </Link>
    );
  }
  return (
    <button type="button" className="k-appbar__action" onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}

export function Page({ appBar, children }) {
  return (
    <div className="k-app">
      {appBar}
      <main className="k-app-main">
        <div className="bq-column k-stack">{children}</div>
      </main>
    </div>
  );
}
