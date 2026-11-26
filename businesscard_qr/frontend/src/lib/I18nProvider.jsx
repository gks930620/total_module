// 다국어 화면 배선. 순수 로직은 i18n.js 에 있고(테스트 대상), 여기서는 React 와 연결만 한다.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FALLBACK_LANGUAGE, pickLanguage, translate } from "./i18n.js";
import ko from "../locales/ko.json";
import en from "../locales/en.json";
import ja from "../locales/ja.json";
import zh from "../locales/zh.json";
import es from "../locales/es.json";
import de from "../locales/de.json";

const MESSAGES = { ko, en, ja, zh, es, de };

/** 언어 선택 메뉴에 보일 이름 — 각 언어로 자기 이름을 적는다(번역하지 않는 게 관례다). */
export const LANGUAGE_NAMES = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文（简体）",
  es: "Español",
  de: "Deutsch",
};

/** 사용자가 고른 언어. 자격증명이 아니라 화면 설정이라 localStorage 에 둬도 된다. */
const STORAGE_KEY = "bq.lang";

function readSavedLanguage() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // 사파리 개인 정보 보호 모드 등 — 저장 못 해도 화면은 떠야 한다
  }
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => pickLanguage(navigator.languages ?? [navigator.language], readSavedLanguage()));

  useEffect(() => {
    document.documentElement.lang = lang;
    // PWA 설치 이름도 언어를 따르게 한다(한국어=명함QR, 나머지=Businesscard QR).
    // manifest 는 서버가 lang 쿼리를 보고 만들어 준다.
    document.querySelector('link[rel="manifest"]')?.setAttribute("href", `/manifest.webmanifest?lang=${lang}`);
    document.title = MESSAGES[lang].appTitle;
  }, [lang]);

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 저장 실패는 무시 — 이번 방문 동안은 바뀐 언어가 유지된다
    }
  }, []);

  const value = useMemo(() => {
    const t = (key, params) => translate(lang, MESSAGES[lang], MESSAGES[FALLBACK_LANGUAGE], key, params);
    const formatDate = (iso) => {
      if (!iso) return "";
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(date);
    };
    return { lang, setLang, t, formatDate };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n 은 I18nProvider 안에서만 쓸 수 있다.");
  return value;
}
