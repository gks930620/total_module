// "홈 화면에 추가" 안내. 브라우저가 설치 가능하다고 알려줄 때(beforeinstallprompt)만 보인다.
// iOS 사파리는 이 이벤트가 없어 보이지 않는다 — 공유 메뉴의 "홈 화면에 추가"로 설치한다.
import { useEffect, useState } from "react";
import { useI18n } from "../lib/I18nProvider.jsx";
import Icon from "./Icon.jsx";

const DISMISS_KEY = "bq.installDismissed";

function dismissedBefore() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    if (dismissedBefore()) return undefined;
    const onPrompt = (event) => {
      event.preventDefault(); // 브라우저 기본 배너 대신 우리 문구로 보여준다
      setDeferred(event);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const install = async () => {
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null); // 이벤트는 한 번만 쓸 수 있다
  };

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 저장 못 하면 다음 방문에 다시 보일 뿐이다
    }
    setDeferred(null);
  };

  return (
    <div className="k-card bq-install" role="region" aria-label={t("installTitle")}>
      <div className="k-flex bq-install-row">
        <div className="k-item__main">
          <strong>{t("installTitle")}</strong>
          <p className="k-muted">{t("installBody")}</p>
        </div>
        <button type="button" className="k-btn k-btn--secondary k-btn--sm" onClick={install}>
          {t("installAction")}
        </button>
        <button type="button" className="k-btn k-btn--ghost k-btn--icon k-btn--sm" onClick={dismiss} aria-label={t("actionClose")}>
          <Icon name="close" size={18} />
        </button>
      </div>
    </div>
  );
}
