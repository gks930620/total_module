// 바이트 크기 변환 — 전부 클라이언트(NFR-02).
// KB(1000) 와 KiB(1024) 를 명확히 구분한다 — 디스크 용량·전송량 계산에서 자주 헷갈리는 지점.

const BINARY_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
const DECIMAL_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

const UNIT_FACTOR = {
  b: 1, byte: 1, bytes: 1,
  kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4, pib: 1024 ** 5,
  kb: 1000, mb: 1000 ** 2, gb: 1000 ** 3, tb: 1000 ** 4, pb: 1000 ** 5,
  // 흔한 축약(k, m, g)은 관례상 2진으로 본다 — 화면에도 표기한다
  k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4,
};

/** "1.5 GiB" → { ok, bytes, unit, factor } */
export function parseSize(input) {
  const s = String(input ?? "").trim().toLowerCase().replace(/,/g, "");
  if (!s) return { ok: false, reason: "크기를 입력해 주세요." };

  const m = /^([0-9]*\.?[0-9]+)\s*([a-z]*)$/.exec(s);
  if (!m) return { ok: false, reason: "숫자 + 단위 형식으로 입력해 주세요. 예) 1.5 GiB" };

  const num = parseFloat(m[1]);
  const unit = m[2] || "b";
  const factor = UNIT_FACTOR[unit];
  if (factor === undefined) {
    return { ok: false, reason: `모르는 단위입니다: ${m[2]}` };
  }
  return { ok: true, bytes: Math.round(num * factor), unit, factor };
}

function trimNumber(n) {
  // 소수점 이하 불필요한 0 제거 (1.50 → 1.5, 1.00 → 1)
  return Number(n.toFixed(2)).toString();
}

/** 바이트 → 사람이 읽는 문자열. mode: "binary"(KiB) | "decimal"(KB) */
export function formatBytes(bytes, mode = "binary") {
  const n = Number(bytes) || 0;
  const step = mode === "decimal" ? 1000 : 1024;
  const units = mode === "decimal" ? DECIMAL_UNITS : BINARY_UNITS;
  if (n < step) return `${n} B`;

  let value = n;
  let i = 0;
  while (value >= step && i < units.length - 1) {
    value /= step;
    i++;
  }
  return `${trimNumber(value)} ${units[i]}`;
}

/** 모든 단위 동시 환산 */
export function convertSize(bytes) {
  const n = Number(bytes) || 0;
  const binary = {};
  const decimal = {};
  BINARY_UNITS.forEach((u, i) => {
    binary[u] = n / 1024 ** i;
  });
  DECIMAL_UNITS.forEach((u, i) => {
    decimal[u] = n / 1000 ** i;
  });
  return {
    bytes: n,
    bits: n * 8,
    binary,
    decimal,
    humanBinary: formatBytes(n, "binary"),
    humanDecimal: formatBytes(n, "decimal"),
  };
}
