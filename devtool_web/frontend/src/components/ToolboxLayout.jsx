// 공통 레이아웃: 헤더(로고 · 테마) + 콘텐츠 + 푸터.
//
// 사이드바를 걷어낸 상태다. 본문이 화면 폭을 다 쓰고, 모바일과 데스크톱 구조가 같다.
// **검색은 홈 히어로 한 곳에만 둔다** — 헤더에도 두면 홈에서 검색창이 둘이 된다.
// 그래서 도구 페이지에서 다른 도구로 가려면 로고를 눌러 홈으로 간다.
import { useState, useEffect, Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { TOOLS } from "../lib/tools.js";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import { THEMES, getThemeSetting, setThemeSetting, initTheme } from "../lib/theme.js";

function ThemeToggle() {
  const [setting, setSetting] = useState(() => getThemeSetting());

  const cycle = () => {
    const idx = THEMES.findIndex((t) => t.key === setting);
    const next = THEMES[(idx + 1) % THEMES.length];
    setThemeSetting(next.key);
    setSetting(next.key);
  };

  const current = THEMES.find((t) => t.key === setting) || THEMES[0];
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      title={`화면 테마: ${current.label} (눌러서 전환)`}
      aria-label={`화면 테마 ${current.label}, 눌러서 전환`}
    >
      <span className="material-icons">{current.icon}</span>
      <span className="theme-label">{current.label}</span>
    </button>
  );
}

export function ToolboxLayout() {
  // 도구가 바뀌면 오류 경계를 새로 만든다 — 한 도구가 죽은 뒤 다른 도구로 옮겼는데도
  // 오류 화면이 남아 있으면 사이트가 통째로 고장난 것처럼 보인다.
  const { pathname } = useLocation();

  useEffect(() => initTheme(), []);

  return (
    <div className="app-root">
      {/* 키보드로 들어온 사람이 헤더를 일일이 지나치지 않아도 되게 */}
      <a className="skip-link" href="#main">본문으로 건너뛰기</a>

      <header className="app-header">
        <div className="header-container">
          <NavLink to="/" className="header-logo">
            <span className="material-icons">handyman</span>
            <span>개발자 유틸 모음</span>
          </NavLink>
          <ThemeToggle />
        </div>
      </header>

      <div className="app-body">
        <main className="content-area" id="main" tabIndex={-1}>
          {/* 도구 페이지는 라우트 단위로 분할 로딩된다(App.jsx의 lazy) — 첫 진입 번들을 NFR-04 예산 안에 둔다 */}
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<div className="route-loading" role="status" aria-live="polite">불러오는 중…</div>}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* 넣을 것이 정해지면 여기 채운다. 뼈대는 남겨 둔다 — 나중에 붙일 자리다. */}
      <footer className="app-footer">
        <div className="footer-container" />
      </footer>
    </div>
  );
}
