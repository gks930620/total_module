// 테마 설정 — 저장과 "아직 고른 적 없음" 의 표현.
//
// 이 테스트가 없어서 놓친 게 있었다. DEFAULT_SETTINGS.theme 가 "system" 이었는데,
// initTheme 의 OS 변경 추종은 `if (!getSettings().theme)` 로 "고른 적 없음" 을 판별한다.
// "system" 은 truthy 라 그 조건이 절대 참이 되지 않았고, OS 테마를 바꿔도 따라가지 않았다.
// 그래서 여기서 잠근다 — **고른 적 없음은 falsy 여야 한다.**
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSettings, updateSettings } from "../storage.js";
import { getThemeSetting, THEMES } from "../theme.js";

/** window.localStorage 를 흉내 낸다. jsdom 을 들이지 않으려고 최소한만 만든다. */
function stubWindow({ dark = false } = {}) {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
    matchMedia: (q) => ({ matches: dark && q.includes("dark"), addEventListener() {}, removeEventListener() {} }),
  };
  return store;
}

describe("설정 저장", () => {
  afterEach(() => {
    delete globalThis.window;
  });

  it("아직 아무것도 고르지 않았으면 theme 가 falsy 다", () => {
    stubWindow();
    // initTheme 의 `if (!getSettings().theme)` 가 이 값에 걸려 OS 설정을 따라간다.
    // 여기에 "system" 같은 문자열이 들어가면 그 분기가 죽는다.
    expect(getSettings().theme).toBeFalsy();
  });

  it("고른 값은 그대로 남는다", () => {
    stubWindow();
    updateSettings({ theme: "dark" });
    expect(getSettings().theme).toBe("dark");
  });

  it("저장 못 하는 환경(시크릿 모드 등)에서도 기본값을 돌려준다", () => {
    globalThis.window = {
      localStorage: {
        getItem() { throw new Error("차단됨"); },
        setItem() { throw new Error("차단됨"); },
      },
    };
    expect(() => getSettings()).not.toThrow();
    expect(getSettings().json_indent).toBe(2);
  });
});

describe("테마 선택", () => {
  beforeEach(() => stubWindow());
  afterEach(() => {
    delete globalThis.window;
  });

  it("고를 수 있는 건 라이트·다크 둘뿐이다", () => {
    expect(THEMES.map((t) => t.key)).toEqual(["light", "dark"]);
  });

  it("고른 적 없으면 OS 설정을 초기값으로 쓴다", () => {
    stubWindow({ dark: true });
    expect(getThemeSetting()).toBe("dark");
    stubWindow({ dark: false });
    expect(getThemeSetting()).toBe("light");
  });

  it("한 번 고르면 OS 설정보다 그 선택이 앞선다", () => {
    stubWindow({ dark: true });
    updateSettings({ theme: "light" });
    expect(getThemeSetting()).toBe("light");
  });
});
