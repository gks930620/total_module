import { Link } from "react-router-dom";
import { useI18n } from "../lib/I18nProvider.jsx";
import { EmptyState } from "../components/States.jsx";

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="k-app">
      <main className="k-app-main">
        <div className="bq-column">
          <EmptyState
            title={t("notFoundTitle")}
            action={<Link className="k-btn k-btn--secondary" to="/">{t("goHome")}</Link>}
          />
        </div>
      </main>
    </div>
  );
}
