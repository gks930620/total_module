// dtb.* localStorage 헬퍼 (설계 04 §3)
// 저장 실패(시크릿 모드 등)여도 기능 동작에는 영향이 없어야 한다.
// 저장 금지 목록(JSON 원문, 주민번호/JWT 원문, 정규식 문자열)은 여기에 절대 넣지 않는다.

const NS = "dtb.";
const SETTINGS_KEY = NS + "settings";
const SCHEMA_KEY = NS + "schema_version";
const SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS = {
  // null = 아직 고른 적 없음. 반드시 falsy 여야 한다 —
  // theme.js 의 initTheme 이 이 값으로 "OS 설정을 따라갈지" 를 판단한다.
  // 여기에 "system" 같은 문자열을 넣으면 그 분기가 조용히 죽는다.
  theme: null,
  json_indent: 2,
};

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 무시 */
  }
}

function ensureSchema() {
  if (safeGet(SCHEMA_KEY) !== String(SCHEMA_VERSION)) {
    safeSet(SCHEMA_KEY, String(SCHEMA_VERSION));
  }
}

export function getSettings() {
  ensureSchema();
  const raw = safeGet(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch };
  safeSet(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
