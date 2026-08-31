// 해시 생성기 — 전부 클라이언트(NFR-02).
// SHA 계열은 브라우저 내장 WebCrypto(SubtleCrypto)를 쓰고,
// WebCrypto 가 지원하지 않는 MD5·CRC32 만 직접 구현한다(외부 라이브러리 없음).
//
// ⚠️ MD5/SHA-1 은 충돌이 발견된 알고리즘이다. 파일 무결성 확인·레거시 호환 용도로만 쓰고
//    비밀번호 저장이나 서명에는 쓰지 말 것 — 화면에도 경고를 띄운다.

const encoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── MD5 (RFC 1321) ─────────────────────────────────────────────

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

// K[i] = floor(abs(sin(i+1)) * 2^32)
const MD5_K = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
  MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
}

function rotl32(x, c) {
  return (x << c) | (x >>> (32 - c));
}

/**
 * SHA-1 을 **동기로** 계산해 바이트로 준다.
 *
 * <p>보통은 Web Crypto 에 맡기지만(그게 이 파일의 원칙이다) UUID v5 는 동기 함수여야 한다 —
 * 비동기로 만들면 `generateMany` 부터 화면 렌더까지 전부 비동기가 된다.
 * MD5 를 직접 구현한 것과 같은 사정이고, RFC 기준값을 테스트가 고정하고 있다.
 * **보안 목적으로는 쓰지 말 것** — 이름을 섞는 용도다.
 */
export function sha1Bytes(input) {
  const msg = typeof input === "string" ? encoder.encode(input) : input;
  const bitLen = msg.length * 8;

  // 패딩: 0x80 + 0x00… → 길이 % 64 == 56, 이후 8바이트 빅엔디언 비트길이
  const padded = new Uint8Array(((msg.length + 8) >> 6 << 6) + 64);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0, false);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32), false);

  let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 80; i++) w[i] = rotl32(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

    let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
    for (let i = 0; i < 80; i++) {
      let f;
      let k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }

      const t = (rotl32(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rotl32(b, 30) >>> 0; b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  new DataView(out.buffer).setUint32(0, h0, false);
  new DataView(out.buffer).setUint32(4, h1, false);
  new DataView(out.buffer).setUint32(8, h2, false);
  new DataView(out.buffer).setUint32(12, h3, false);
  new DataView(out.buffer).setUint32(16, h4, false);
  return out;
}

/** MD5 해시(hex 소문자). 입력은 문자열(UTF-8) 또는 Uint8Array. */
export function md5(input) {
  const msg = typeof input === "string" ? encoder.encode(input) : input;
  const originalBitLen = msg.length * 8;

  // 패딩: 0x80 + 0x00... → 길이 % 64 == 56, 이후 8바이트 리틀엔디언 비트길이
  const padded = new Uint8Array((((msg.length + 8) >> 6) + 1) * 64);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const view = new DataView(padded.buffer);
  // 2^53 미만 길이만 다룬다(브라우저 입력 규모상 충분)
  view.setUint32(padded.length - 8, originalBitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(originalBitLen / 4294967296), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Uint32Array(16);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(offset + i * 4, true);

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F;
      let g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + MD5_K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl32(F, MD5_S[i])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true);
  ov.setUint32(4, b0, true);
  ov.setUint32(8, c0, true);
  ov.setUint32(12, d0, true);
  return toHex(out);
}

// ── CRC-32 (IEEE 802.3) ────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 체크섬(hex 8자리). 해시가 아니라 오류 검출용 — 화면에도 표기한다. */
export function crc32(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

// ── SHA 계열 (WebCrypto) ───────────────────────────────────────

/** SHA-1 / SHA-256 / SHA-384 / SHA-512 (hex 소문자) */
export async function sha(algorithm, input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  const digest = await crypto.subtle.digest(algorithm, bytes);
  return toHex(new Uint8Array(digest));
}

export const HASH_ALGOS = [
  { key: "crc32", label: "CRC-32", note: "체크섬(해시 아님)", weak: false },
  { key: "md5", label: "MD5", note: "128비트 · 충돌 발견됨", weak: true },
  { key: "sha-1", label: "SHA-1", note: "160비트 · 충돌 발견됨", weak: true },
  { key: "sha-256", label: "SHA-256", note: "256비트 · 권장", weak: false },
  { key: "sha-384", label: "SHA-384", note: "384비트", weak: false },
  { key: "sha-512", label: "SHA-512", note: "512비트", weak: false },
];

// ── HMAC — 키를 아는 사람만 만들 수 있는 해시 ───────────────
//
// 해시만으로는 "이걸 만든 게 너인지" 를 증명하지 못한다. 중간에서 내용을 바꾸고 해시도
// 다시 계산하면 그만이기 때문이다. 웹훅 서명 검증(Stripe·GitHub·토스 등)이 전부 이것이라,
// "받은 X-Signature 가 맞나" 를 확인하려면 필요하다.
//
// MD5·CRC32 는 없다 — Web Crypto 가 HMAC 에 SHA 계열만 허용한다. 직접 만들지 않는다.

export const HMAC_ALGOS = [
  { key: "sha-1", label: "HMAC-SHA1", subtle: "SHA-1", weak: true },
  { key: "sha-256", label: "HMAC-SHA256", subtle: "SHA-256" },
  { key: "sha-384", label: "HMAC-SHA384", subtle: "SHA-384" },
  { key: "sha-512", label: "HMAC-SHA512", subtle: "SHA-512" },
];

const toBytes = (v) => (typeof v === "string" ? encoder.encode(v) : v);

/**
 * HMAC 을 계산한다.
 * @param {string} algorithm HMAC_ALGOS 의 key
 * @param {string|Uint8Array} key 비밀키
 * @param {string|Uint8Array} message
 * @returns {Promise<string>} 소문자 16진
 */
export async function hmac(algorithm, key, message) {
  const algo = HMAC_ALGOS.find((a) => a.key === String(algorithm || "").toLowerCase());
  if (!algo) {
    throw new Error(`${algorithm} 로는 HMAC 을 만들 수 없습니다. SHA 계열만 됩니다.`);
  }
  const rawKey = toBytes(key);
  if (!rawKey?.length) throw new Error("비밀키를 입력해 주세요.");

  const cryptoKey = await crypto.subtle.importKey(
    "raw", rawKey, { name: "HMAC", hash: algo.subtle }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, toBytes(message));
  return toHex(new Uint8Array(sig));
}

/** 네 가지를 한 번에 — 상대가 어느 것을 썼는지 모를 때가 많다 */
export async function hmacAll(key, message) {
  const out = {};
  for (const algo of HMAC_ALGOS) out[algo.key] = await hmac(algo.key, key, message);
  return out;
}

// ── 기대값 대조 ────────────────────────────────────────────
//
// 이 도구의 진짜 쓰임은 "값을 만드는 것" 이 아니라 **"남이 준 값과 같은가"** 다.
// 64자 16진수 두 줄을 눈으로 대조하게 두면 사람이 틀린다.

/**
 * 붙여넣은 해시를 비교할 수 있는 모양으로 다듬는다.
 *
 * <p>실제로 붙여넣는 형태가 제각각이다 — `sha256sum` 은 뒤에 파일명을 붙이고,
 * 윈도 `certutil` 은 두 글자마다 공백을 넣으며, 어떤 문서는 콜론으로 끊는다.
 */
export function normalizeHash(text) {
  const s = String(text ?? "").trim();
  if (!s) return "";
  // "<해시>  <파일명>" 형태면 앞의 16진 덩어리만 쓴다
  const first = s.split(/\s+/)[0];
  const candidate = /^[0-9a-fA-F]+$/.test(first) && first.length >= 8 ? first : s;
  return candidate.replace(/[\s:-]/g, "").toLowerCase();
}

/** 16진 길이 → 어떤 알고리즘을 기대한 값인가 */
const LENGTH_HINT = { 8: "crc32", 32: "md5", 40: "sha-1", 64: "sha-256", 96: "sha-384", 128: "sha-512" };

/**
 * 계산 결과들과 기대값을 견준다.
 *
 * @param {object} results hashAll 의 결과 (알고리즘 → 16진)
 * @param {string} expected 사용자가 붙여넣은 값
 * @returns {{checked:boolean, matched:string|null, guessed:string|null, invalid?:boolean, normalized:string}}
 */
export function compareHash(results, expected) {
  const normalized = normalizeHash(expected);
  if (!normalized) return { checked: false, matched: null, guessed: null, normalized: "" };

  if (!/^[0-9a-f]+$/.test(normalized)) {
    return { checked: true, matched: null, guessed: null, invalid: true, normalized };
  }

  const matched = Object.keys(results || {}).find(
    (k) => String(results[k]).toLowerCase() === normalized,
  ) || null;

  return {
    checked: true,
    matched,
    guessed: LENGTH_HINT[normalized.length] || null,
    normalized,
  };
}

/** 지원 알고리즘 전부를 한 번에 계산한다. */
export async function hashAll(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  const out = {};
  for (const algo of HASH_ALGOS) {
    if (algo.key === "md5") out[algo.key] = md5(bytes);
    else if (algo.key === "crc32") out[algo.key] = crc32(bytes);
    else out[algo.key] = await sha(algo.label.replace("SHA-", "SHA-"), bytes);
  }
  return out;
}
