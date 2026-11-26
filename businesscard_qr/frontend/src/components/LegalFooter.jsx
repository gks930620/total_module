// 화면 아래 법적 고지 — 약관·개인정보처리방침 링크와 사업자 정보.
// 첫 화면과 결제 화면(프로)에 둔다: 전자상거래법상 표시 의무이고, 결제대행사(토스) 심사 항목이다.
import { useI18n } from "../lib/I18nProvider.jsx";
import { BUSINESS } from "../lib/business.js";
import { legalDocUrl } from "../lib/legal.js";

const BUSINESS_ROWS = [
  ["bizName", "name"],
  ["bizRepresentative", "representative"],
  ["bizRegistrationNo", "registrationNo"],
  ["bizMailOrderNo", "mailOrderNo"],
  ["bizAddress", "address"],
  ["bizContact", "email"],
];

export default function LegalFooter({ withBusinessInfo = true }) {
  const { t, lang } = useI18n();
  return (
    <footer className="bq-legal">
      {/* 문서는 앱에서 고른 언어로 연다(브라우저 언어가 아니라) */}
      <nav aria-label="legal">
        <a href={legalDocUrl("/terms.html", lang)}>{t("legalTerms")}</a>
        <span aria-hidden="true"> · </span>
        {/* 개인정보처리방침은 다른 링크와 구별되게(굵게) 표시한다 — 개인정보보호위원회 작성지침 */}
        <a href={legalDocUrl("/privacy.html", lang)}><strong>{t("legalPrivacy")}</strong></a>
        <span aria-hidden="true"> · </span>
        <a href={legalDocUrl("/account-deletion.html", lang)}>{t("legalAccountDeletion")}</a>
      </nav>
      {withBusinessInfo && (
        <dl className="bq-biz">
          {BUSINESS_ROWS.map(([labelKey, field]) => (
            <div key={field}>
              <dt>{t(labelKey)}</dt>
              <dd>{BUSINESS[field]}</dd>
            </div>
          ))}
        </dl>
      )}
    </footer>
  );
}
