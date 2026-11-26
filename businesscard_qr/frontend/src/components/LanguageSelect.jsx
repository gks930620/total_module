import { useId } from "react";
import { useI18n, LANGUAGE_NAMES } from "../lib/I18nProvider.jsx";
import { SUPPORTED_LANGUAGES } from "../lib/i18n.js";

/** 언어 선택. 각 언어는 자기 언어로 이름을 보여준다 — 못 읽는 언어로 바뀌어도 되돌아올 수 있게. */
export default function LanguageSelect({ compact = false }) {
  const { lang, setLang, t } = useI18n();
  const id = useId();

  return (
    <div className={compact ? "bq-lang-compact" : "k-field"}>
      <label className={compact ? "k-sr" : "k-label"} htmlFor={id}>
        {t("menuLanguage")}
      </label>
      <select id={id} className="k-select" value={lang} onChange={(event) => setLang(event.target.value)}>
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LANGUAGE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
