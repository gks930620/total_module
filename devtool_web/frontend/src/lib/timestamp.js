// 타임스탬프 ↔ 날짜 변환 유틸 — 전부 클라이언트(NFR-02).
// 한국 개발자 기준으로 KST(+09:00)를 1급 시민으로 다룬다.
// 브라우저 로컬 타임존에 의존하지 않도록 KST 계산은 고정 오프셋으로 직접 한다
// (테스트 재현성 + 해외 로컬 타임존 사용자에게도 동일 결과).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** 숫자 문자열의 자릿수로 epoch 단위를 추정한다. 초/밀리/마이크로/나노. */
export function detectUnit(input) {
  const s = String(input ?? "").trim();
  if (!/^-?\d+$/.test(s)) return null;
  const digits = s.replace("-", "").length;
  if (digits <= 11) return "s";
  if (digits <= 14) return "ms";
  if (digits <= 17) return "us";
  return "ns";
}

const UNIT_TO_MS = { s: 1000, ms: 1, us: 1 / 1000, ns: 1 / 1000000 };

/** epoch 숫자(단위 자동 판별) 또는 날짜 문자열을 밀리초로 변환. 실패 시 null. */
export function parseAnyToMs(input) {
  const s = String(input ?? "").trim();
  if (!s) return null;

  const unit = detectUnit(s);
  if (unit) {
    return Math.round(Number(s) * UNIT_TO_MS[unit]);
  }

  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : parsed;
}

function pad(n, width = 2) {
  return String(n).padStart(width, "0");
}

/** ISO-8601 (UTC, 밀리초 포함) */
export function formatIso(ms) {
  return new Date(ms).toISOString();
}

// 고정 오프셋을 더한 뒤 UTC 게터로 읽으면 로컬 타임존과 무관하게 해당 존의 벽시계가 나온다.
function wallClock(ms, offsetMs) {
  const d = new Date(ms + offsetMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: WEEKDAY_KO[d.getUTCDay()],
  };
}

function formatWall(ms, offsetMs, label) {
  const w = wallClock(ms, offsetMs);
  return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)} (${label})`;
}

/** 한국 표준시(+09:00) 벽시계 표기 */
export function formatKst(ms) {
  return formatWall(ms, KST_OFFSET_MS, "KST");
}

/** UTC 벽시계 표기 */
export function formatUtc(ms) {
  return formatWall(ms, 0, "UTC");
}

/** 상세 분해 — 화면 표에 그대로 쓴다. */
export function breakdown(ms) {
  const k = wallClock(ms, KST_OFFSET_MS);
  const u = wallClock(ms, 0);
  return {
    epochSeconds: Math.floor(ms / 1000),
    epochMillis: ms,
    kstYear: k.year,
    kstMonth: k.month,
    kstDay: k.day,
    kstHour: k.hour,
    kstMinute: k.minute,
    kstSecond: k.second,
    kstWeekday: k.weekday,
    utcWeekday: u.weekday,
    // 해당 연도의 며칠째인지 (KST 기준)
    dayOfYear:
      Math.floor((Date.UTC(k.year, k.month - 1, k.day) - Date.UTC(k.year, 0, 1)) / 86400000) + 1,
  };
}

const RELATIVE_STEPS = [
  { limit: 60 * 1000, unit: null },
  { limit: 60 * 60 * 1000, div: 60 * 1000, suffix: "분" },
  { limit: 24 * 60 * 60 * 1000, div: 60 * 60 * 1000, suffix: "시간" },
  { limit: 30 * 24 * 60 * 60 * 1000, div: 24 * 60 * 60 * 1000, suffix: "일" },
  { limit: 365 * 24 * 60 * 60 * 1000, div: 30 * 24 * 60 * 60 * 1000, suffix: "개월" },
  { limit: Infinity, div: 365 * 24 * 60 * 60 * 1000, suffix: "년" },
];

/** "3일 전" / "2시간 후" 같은 한국어 상대시간. */
export function toRelativeKo(ms, nowMs = Date.now()) {
  const diff = ms - nowMs;
  const abs = Math.abs(diff);
  const step = RELATIVE_STEPS.find((s) => abs < s.limit);
  if (!step || !step.div) return "방금";
  const n = Math.floor(abs / step.div);
  return `${n}${step.suffix} ${diff < 0 ? "전" : "후"}`;
}
