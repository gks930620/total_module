// 진법 변환 · 비트 연산 — 전부 클라이언트(NFR-02).
// 64비트를 넘는 값도 다루기 위해 내부 표현은 BigInt 로 통일한다.

export const BIT_WIDTHS = [8, 16, 32, 64];

const PREFIX_BASE = { "0x": 16, "0b": 2, "0o": 8 };

/** 문자열 → { ok, value(BigInt), base } . base 를 주면 그 진법으로, 없으면 접두사로 판별. */
export function parseNumber(input, base = null) {
  let s = String(input ?? "").trim().replace(/[_\s,]/g, "");
  if (!s) return { ok: false, reason: "값을 입력해 주세요." };

  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  let radix = base;
  const prefix = s.slice(0, 2).toLowerCase();
  if (PREFIX_BASE[prefix]) {
    if (base && base !== PREFIX_BASE[prefix]) {
      return { ok: false, reason: `접두사 ${prefix} 와 선택한 진법(${base})이 다릅니다.` };
    }
    radix = PREFIX_BASE[prefix];
    s = s.slice(2);
  } else if (!radix) {
    radix = 10;
  }

  if (radix < 2 || radix > 36) return { ok: false, reason: "진법은 2~36 이어야 합니다." };
  if (!s) return { ok: false, reason: "숫자 부분이 비어 있습니다." };

  const digits = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, radix);
  let value = 0n;
  const bigRadix = BigInt(radix);
  for (const ch of s.toLowerCase()) {
    const d = digits.indexOf(ch);
    if (d < 0) {
      return { ok: false, reason: `${radix}진수에 쓸 수 없는 문자입니다: '${ch}'` };
    }
    value = value * bigRadix + BigInt(d);
  }

  return { ok: true, value: negative ? -value : value, base: radix };
}

/** BigInt → 지정 진법 문자열(소문자) */
export function toBase(value, base) {
  return value.toString(base);
}

/** 주요 진법 동시 변환 */
export function convertAllBases(value) {
  return {
    bin: toBase(value, 2),
    oct: toBase(value, 8),
    dec: toBase(value, 10),
    hex: toBase(value, 16),
  };
}

function maskFor(bitWidth) {
  return (1n << BigInt(bitWidth)) - 1n;
}

/** 2의 보수 기준 비트 문자열 (4비트씩 공백 구분) */
export function toBitString(value, bitWidth) {
  const masked = value & maskFor(bitWidth);
  const bits = masked.toString(2).padStart(bitWidth, "0");
  return bits.match(/.{1,4}/g).join(" ");
}

/** 부호 있는 값으로 해석 (2의 보수) */
export function toSigned(value, bitWidth) {
  const masked = value & maskFor(bitWidth);
  const signBit = 1n << BigInt(bitWidth - 1);
  return masked & signBit ? masked - (1n << BigInt(bitWidth)) : masked;
}

export const BITWISE_OPS = [
  { key: "and", label: "AND (&)" },
  { key: "or", label: "OR (|)" },
  { key: "xor", label: "XOR (^)" },
  { key: "not", label: "NOT (~A)" },
  { key: "shl", label: "왼쪽 시프트 (A << n)" },
  { key: "shr", label: "오른쪽 시프트 (A >> n)" },
];

/** 비트 연산. 결과는 항상 비트폭으로 마스킹한 양수 BigInt. */
export function bitwise(op, a, b, bitWidth) {
  const mask = maskFor(bitWidth);
  const x = a & mask;
  const y = b & mask;
  switch (op) {
    case "and": return (x & y) & mask;
    case "or": return (x | y) & mask;
    case "xor": return (x ^ y) & mask;
    case "not": return ~x & mask;
    case "shl": return (x << y) & mask;
    case "shr": return (x >> y) & mask;
    default: return 0n;
  }
}
