// cron 표현식 해석기 — 전부 클라이언트(NFR-02).
// 5필드(분 시 일 월 요일) 및 6필드(초 포함, Spring @Scheduled 스타일)를 지원한다.
// 다음 실행 시각은 KST(+09:00) 고정으로 계산한다 — 한국 개발자가 서버 크론을 읽는 상황이 기준.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

const DOW_NAMES = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
const MONTH_NAMES = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const SPECIALS = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

// 필드 정의: [이름, 최소, 최대, 별칭표]
const FIELD_SPEC = {
  second: [0, 59, null],
  minute: [0, 59, null],
  hour: [0, 23, null],
  dayOfMonth: [1, 31, null],
  month: [1, 12, MONTH_NAMES],
  dayOfWeek: [0, 6, DOW_NAMES],
};

function expandField(raw, name) {
  const [min, max, names] = FIELD_SPEC[name];
  const values = new Set();

  for (const part of String(raw).split(",")) {
    const token = part.trim();
    if (token === "") throw new Error(`${name}: 빈 값`);

    // step 분리 (*/5, 10-20/5, 5/10)
    const [rangePart, stepPart] = token.split("/");
    let step = 1;
    if (stepPart !== undefined) {
      step = Number(stepPart);
      if (!Number.isInteger(step) || step <= 0) throw new Error(`${name}: 잘못된 간격 /${stepPart}`);
    }

    let lo;
    let hi;
    if (rangePart === "*" || rangePart === "?") {
      lo = min;
      hi = max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");
      lo = toNumber(a, names, name);
      hi = toNumber(b, names, name);
    } else {
      lo = toNumber(rangePart, names, name);
      // "5/10" 은 5부터 max 까지 10 간격
      hi = stepPart !== undefined ? max : lo;
    }

    if (name === "dayOfWeek") {
      if (lo === 7) lo = 0;
      if (hi === 7) hi = 0;
    }
    if (lo < min || hi > max || lo > hi) {
      throw new Error(`${name}: ${min}~${max} 범위를 벗어났습니다 (${token})`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }

  return [...values].sort((a, b) => a - b);
}

function toNumber(token, names, fieldName) {
  const t = String(token).trim().toUpperCase();
  if (names && names[t] !== undefined) return names[t];
  const n = Number(t);
  if (!Number.isInteger(n)) throw new Error(`${fieldName}: 숫자가 아닙니다 (${token})`);
  return n;
}

/** cron 문자열 파싱. { ok, hasSeconds, fields, error } */
export function parseCron(expr) {
  const input = String(expr ?? "").trim();
  if (!input) return { ok: false, error: "표현식이 비어 있습니다." };

  const normalized = SPECIALS[input.toLowerCase()] || input;
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) {
    return { ok: false, error: `필드는 5개(분 시 일 월 요일) 또는 6개(초 포함)여야 합니다. 현재 ${parts.length}개.` };
  }

  const hasSeconds = parts.length === 6;
  const [second, minute, hour, dayOfMonth, month, dayOfWeek] = hasSeconds
    ? parts
    : ["0", ...parts];

  try {
    return {
      ok: true,
      hasSeconds,
      normalized,
      fields: {
        second: expandField(second, "second"),
        minute: expandField(minute, "minute"),
        hour: expandField(hour, "hour"),
        dayOfMonth: expandField(dayOfMonth, "dayOfMonth"),
        month: expandField(month, "month"),
        dayOfWeek: expandField(dayOfWeek, "dayOfWeek"),
      },
      // 원본 토큰 — "*" 인지 판별해 설명 문구를 자연스럽게 만든다
      tokens: { second, minute, hour, dayOfMonth, month, dayOfWeek },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function isAll(token) {
  return token === "*" || token === "?";
}

function listKo(values, formatter) {
  if (values.length === 0) return "";
  if (values.length <= 4) return values.map(formatter).join(", ");
  // 연속 구간이면 범위로 축약
  const consecutive = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
  if (consecutive) return `${formatter(values[0])}~${formatter(values[values.length - 1])}`;
  return `${values.slice(0, 4).map(formatter).join(", ")} 외 ${values.length - 4}개`;
}

const pad2 = (n) => String(n).padStart(2, "0");

/** cron 을 한국어 문장으로 설명한다. */
export function describeCron(expr) {
  const r = parseCron(expr);
  if (!r.ok) return `해석할 수 없습니다 — ${r.error}`;

  const { fields, tokens, hasSeconds } = r;
  const chunks = [];

  // 월
  if (!isAll(tokens.month)) chunks.push(`${listKo(fields.month, (m) => `${m}월`)}`);

  // 일 / 요일
  const dowAll = isAll(tokens.dayOfWeek);
  const domAll = isAll(tokens.dayOfMonth);
  if (!domAll) chunks.push(`${listKo(fields.dayOfMonth, (d) => `${d}일`)}`);
  if (!dowAll) chunks.push(`${listKo(fields.dayOfWeek, (d) => WEEKDAY_KO[d])}요일`);
  if (domAll && dowAll) chunks.push("매일");

  // 시각
  const hourAll = isAll(tokens.hour);
  const minAll = isAll(tokens.minute);
  const secAll = hasSeconds && isAll(tokens.second);

  let timePart;
  if (hourAll && minAll) {
    timePart = secAll || !hasSeconds ? "매분" : `매분 ${listKo(fields.second, (s) => `${s}초`)}`;
  } else if (hourAll) {
    timePart = `매시 ${listKo(fields.minute, (m) => `${m}분`)}`;
  } else if (minAll) {
    timePart = `${listKo(fields.hour, (h) => `${pad2(h)}시`)} 매분`;
  } else if (fields.hour.length === 1 && fields.minute.length === 1) {
    timePart = `${pad2(fields.hour[0])}:${pad2(fields.minute[0])}`;
  } else {
    timePart = `${listKo(fields.hour, (h) => `${pad2(h)}시`)} ${listKo(fields.minute, (m) => `${m}분`)}`;
  }

  const when = chunks.join(" ");
  return `${when} ${timePart}에 실행 (KST 기준)`.replace(/\s+/g, " ").trim();
}

// ── 다음 실행 시각 계산 ────────────────────────────────────────
// KST 벽시계로 1초/1분씩 전진하며 필드 일치를 찾는다. 탐색 상한을 둬서 무한 루프를 막는다.

const MAX_SCAN_ITERATIONS = 400000;

function kstParts(ms) {
  const d = new Date(ms + KST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    dow: d.getUTCDay(),
  };
}

function matches(p, f, tokens) {
  if (!f.month.includes(p.month)) return false;
  if (!f.hour.includes(p.hour)) return false;
  if (!f.minute.includes(p.minute)) return false;
  if (!f.second.includes(p.second)) return false;

  // cron 관례: 일·요일이 둘 다 제한되면 OR, 하나만 제한되면 그것만 적용
  const domAll = isAll(tokens.dayOfMonth);
  const dowAll = isAll(tokens.dayOfWeek);
  const domOk = f.dayOfMonth.includes(p.day);
  const dowOk = f.dayOfWeek.includes(p.dow);
  if (domAll && dowAll) return true;
  if (domAll) return dowOk;
  if (dowAll) return domOk;
  return domOk || dowOk;
}

/** 다음 실행 시각 목록. [{ ms, kst, relativeSeconds }] */
export function nextRuns(expr, { from = Date.now(), count = 5 } = {}) {
  const r = parseCron(expr);
  if (!r.ok) return [];

  const stepMs = r.hasSeconds ? 1000 : 60000;
  // 다음 경계로 올림 (현재 시각 자신은 제외)
  let cursor = Math.floor(from / stepMs) * stepMs + stepMs;

  const out = [];
  for (let i = 0; i < MAX_SCAN_ITERATIONS && out.length < count; i++) {
    const p = kstParts(cursor);
    if (matches(p, r.fields, r.tokens)) {
      out.push({
        ms: cursor,
        kst: `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`,
        weekday: WEEKDAY_KO[p.dow],
        afterSeconds: Math.round((cursor - from) / 1000),
      });
    }
    cursor += stepMs;
  }
  return out;
}

/** 화면 프리셋 */
export const CRON_PRESETS = [
  { label: "매분", expr: "* * * * *" },
  { label: "5분마다", expr: "*/5 * * * *" },
  { label: "매시 정각", expr: "0 * * * *" },
  { label: "매일 새벽 3시", expr: "0 3 * * *" },
  { label: "평일 오전 9시", expr: "0 9 * * 1-5" },
  { label: "매주 월요일 자정", expr: "0 0 * * 1" },
  { label: "매월 1일 00:00", expr: "0 0 1 * *" },
  { label: "30분마다(업무시간)", expr: "*/30 9-18 * * 1-5" },
];

/**
 * 필드에 쓴 문법 한 조각을 한국어로 풀이한다 — 간격 표기(별표 슬래시 30)는 "30분마다".
 *
 * <p>"이 필드에 걸리는 값 전부"(0, 30, 60 …)를 늘어놓는 것과는 다르다. 그건 아래
 * '다음 실행 시각' 이 이미 구체적으로 보여 준다. 여기서 알고 싶은 건 **내가 쓴 기호가
 * 무슨 뜻인가** 이다.
 *
 * @param token 그 필드에 적은 문자열
 * @param field FIELD_SPEC 의 키(second·minute·hour·dayOfMonth·month·dayOfWeek)
 */
export function explainCronToken(token, field) {
  const raw = String(token ?? "").trim();
  if (raw === "") return "";
  if (raw === "?") return "지정 안 함";

  const unit = { second: "초", minute: "분", hour: "시", dayOfMonth: "일", month: "월", dayOfWeek: "요일" }[field] ?? "";
  const everyUnit = { second: "초", minute: "분", hour: "시간", dayOfMonth: "일", month: "개월", dayOfWeek: "요일" }[field] ?? "";

  // 값 하나를 사람이 읽는 말로 — 요일은 이름, 나머지는 숫자+단위
  const one = (v) => {
    const n = readCronValue(v, field);
    if (n === null) return String(v);
    if (field === "dayOfWeek") return `${WEEKDAY_KO[n % 7]}요일`;
    return `${n}${unit}`;
  };

  const part = (p) => {
    if (p === "*") {
      if (field === "dayOfWeek") return "요일 상관없음";
      if (field === "dayOfMonth") return "날짜 상관없음";
      return `매${unit}`;
    }
    const [body, step] = p.split("/");
    if (step !== undefined) {
      if (body === "*") return `${step}${everyUnit}마다`;
      const [a, b] = body.split("-");
      if (b !== undefined) return `${one(a)}~${one(b)} 사이 ${step}${everyUnit} 간격`;
      return `${one(body)}부터 ${step}${everyUnit} 간격`;
    }
    const [a, b] = p.split("-");
    if (b !== undefined) return `${one(a)}~${one(b)}`;
    return one(p);
  };

  return raw.split(",").map(part).join(", ");
}

/** "MON"·"JAN" 같은 이름과 숫자를 함께 읽는다 */
function readCronValue(v, field) {
  const names = FIELD_SPEC[field]?.[2];
  const key = String(v).toUpperCase();
  if (names && key in names) return names[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
