// 다크 모드 (COM-08) — 라이트·다크 토글. 고른 적이 없으면 OS 설정을 초기값으로 쓴다.
// 선택값은 dtb.settings.theme 에 저장한다(설계 04 §3의 기존 키).
// CSS 는 :root[data-theme="dark"] 로 토큰을 덮어쓴다 — styles.css 참조.

import { getSettings, updateSettings } from "./storage.js";

// 고르는 건 라이트·다크 둘뿐이다. "시스템" 은 셋째 선택지로 두면
// 눌렀을 때 화면이 어떻게 되는지 알 수 없어(= OS 설정을 알아야 한다) 뺐다.
// 대신 **아직 고른 적이 없으면** OS 설정을 따른다 — 초기값으로만 쓴다.
export const THEMES = [
  { key: "light", label: "라이트", icon: "light_mode" },
  { key: "dark", label: "다크", icon: "dark_mode" },
];

function prefersDark() {
  return typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** 설정값 → 실제 적용할 테마("light" | "dark") */
export function resolveTheme(setting) {
  if (setting === "dark") return "dark";
  if (setting === "light") return "light";
  return prefersDark() ? "dark" : "light";
}

/** 저장된 선택. 고른 적이 없으면 OS 설정을 따라 초기값을 정한다. */
export function getThemeSetting() {
  const saved = getSettings().theme;
  if (saved === "light" || saved === "dark") return saved;
  return prefersDark() ? "dark" : "light";
}

/** <html data-theme="..."> 를 갱신한다. */
export function applyTheme(setting) {
  const resolved = resolveTheme(setting);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
    // 브라우저 기본 UI(스크롤바·폼 컨트롤)도 함께 맞춘다
    document.documentElement.style.colorScheme = resolved;
  }
  return resolved;
}

export function setThemeSetting(setting) {
  updateSettings({ theme: setting });
  return applyTheme(setting);
}

/**
 * 앱 시작 시 1회 호출. 아직 고른 적이 없으면 OS 설정을 따르고, OS 가 바뀌면 같이 바뀐다.
 * 한 번 고른 뒤에는 그 선택을 유지한다 — 사용자가 정한 걸 OS 가 덮지 않는다.
 * @returns 구독 해제 함수
 */
export function initTheme() {
  applyTheme(getThemeSetting());
  if (typeof window === "undefined" || !window.matchMedia) return () => {};

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (!getSettings().theme) applyTheme(prefersDark() ? "dark" : "light");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
