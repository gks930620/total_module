// UUID / ULID 생성기 — 전부 클라이언트(NFR-02).
// 난수는 crypto.getRandomValues (CSPRNG). Math.random 은 쓰지 않는다.
//
// 해시(v3·v5 용)는 lib/hash.js 것을 쓴다 — 같은 구현을 두 벌 두지 않는다.
import { md5, sha1Bytes } from "./hash.js";

function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

const hex = (b) => b.toString(16).padStart(2, "0");

function bytesToUuid(bytes) {
  const s = Array.from(bytes, hex).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** UUID v4 — 122비트 난수. 가장 널리 쓰이는 형태. */
export function uuidV4() {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  return bytesToUuid(b);
}

/**
 * UUID v7 — 앞 48비트가 유닉스 밀리초라 **생성 순서대로 정렬된다**.
 * DB PK 로 쓸 때 v4 와 달리 인덱스 단편화가 적다(코드컨벤션 §4-1 UUID v7 언급과 동일 취지).
 */
// 같은 밀리초 안에서 순서를 지키기 위한 12비트 카운터 (RFC 9562 §6.2 "Method 1").
// 타임스탬프는 ms 단위라, 한 번에 여러 개를 뽑으면 대부분 같은 ms 에 들어간다.
// 그 아래를 전부 난수로 채우면 **목록이 시간순이 아니게 된다** — "정렬되는 UUID" 라는
// 존재 이유가 정작 한 번에 뽑을 때 깨진다. 그래서 rand_a 자리를 카운터로 쓴다.
let lastMs = -1;
let counter = 0;

export function uuidV7(timestampMs = Date.now()) {
  const b = randomBytes(16);
  let ts = Math.floor(timestampMs);

  if (ts === lastMs) {
    counter += 1;
    if (counter > 0xfff) {
      // 한 ms 에 4096개를 넘겼다. 다음 ms 를 앞당겨 쓰고 카운터를 되감는다.
      ts += 1;
      lastMs = ts;
      counter = 0;
    }
  } else {
    lastMs = ts;
    // 새 ms 마다 난수로 시작하되 위쪽 절반은 비워 둔다 — 증가할 여지를 남긴다(RFC 권고)
    counter = ((b[6] & 0x07) << 8) | b[7];
  }

  // 상위 48비트 = 밀리초 타임스탬프 (빅엔디언)
  b[0] = Math.floor(ts / 2 ** 40) & 0xff;
  b[1] = Math.floor(ts / 2 ** 32) & 0xff;
  b[2] = Math.floor(ts / 2 ** 24) & 0xff;
  b[3] = Math.floor(ts / 2 ** 16) & 0xff;
  b[4] = Math.floor(ts / 2 ** 8) & 0xff;
  b[5] = ts & 0xff;
  b[6] = 0x70 | ((counter >> 8) & 0x0f); // version 7 + 카운터 상위 4비트
  b[7] = counter & 0xff;                 // 카운터 하위 8비트
  b[8] = (b[8] & 0x3f) | 0x80;           // variant 10xx
  return bytesToUuid(b);
}

/** NIL UUID — "값 없음"을 나타내는 예약 UUID. */
export function nilUuid() {
  return "00000000-0000-0000-0000-000000000000";
}

// Crockford Base32: I, L, O, U 제외 — 사람이 옮겨 적을 때 헷갈리지 않게
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** ULID — 26자, 앞 10자가 타임스탬프라 사전식 정렬 = 시간순. URL·파일명에 안전. */
export function ulid(timestampMs = Date.now()) {
  let ts = Math.floor(timestampMs);
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[ts % 32] + time;
    ts = Math.floor(ts / 32);
  }
  const rand = randomBytes(16);
  let random = "";
  for (let i = 0; i < 16; i++) random += CROCKFORD[rand[i] % 32];
  return time + random;
}

const UUID_RE = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i;

/** UUID 문자열 분석 — 버전·variant·(v7이면) 생성 시각. */
export function inspectUuid(input) {
  const s = String(input ?? "").trim().replace(/^urn:uuid:/i, "");
  const m = UUID_RE.exec(s);
  if (!m) {
    return { ok: false, reason: "UUID 형식(8-4-4-4-12 hex)이 아닙니다." };
  }
  const plain = s.replace(/-/g, "").toLowerCase();
  const isNil = /^0{32}$/.test(plain);
  const version = parseInt(plain[12], 16);
  const variantNibble = parseInt(plain[16], 16);

  let variant = "예약됨";
  if (variantNibble >= 0x8 && variantNibble <= 0xb) variant = "RFC 4122";
  else if (variantNibble <= 0x7) variant = "NCS 하위호환";
  else if (variantNibble >= 0xc && variantNibble <= 0xd) variant = "Microsoft GUID";

  const info = {
    ok: true,
    normalized: s.toLowerCase(),
    isNil,
    version: isNil ? 0 : version,
    variant: isNil ? "NIL" : variant,
    versionLabel: VERSION_LABEL[version] || `v${version} (알 수 없음)`,
    timestampMs: null,
  };

  if (version === 7 && !isNil) {
    info.timestampMs = parseInt(plain.slice(0, 12), 16);
  }
  if (version === 1 && !isNil) {
    // 60비트 시각이 time_low·time_mid·time_hi 로 흩어져 있다(빅엔디언이 아니다)
    const timeHi = BigInt(parseInt(plain.slice(13, 16), 16));
    const timeMid = BigInt(parseInt(plain.slice(8, 12), 16));
    const timeLow = BigInt(parseInt(plain.slice(0, 8), 16));
    const ts = (timeHi << 48n) | (timeMid << 32n) | timeLow;
    info.timestampMs = Number((ts - 122192928000000000n) / 10000n);
  }
  return info;
}

const VERSION_LABEL = {
  1: "v1 — 시각 + MAC 주소 기반",
  3: "v3 — 이름 기반(MD5)",
  4: "v4 — 난수 기반",
  5: "v5 — 이름 기반(SHA-1)",
  7: "v7 — 유닉스 시각 + 난수 (정렬 가능)",
};

// ── 이름 기반 (v3 · v5) ────────────────────────────────────
//
// 같은 이름에서 **언제 어디서나 같은 UUID** 가 나온다. 그게 요점이다 —
// 여러 시스템이 서로 묻지 않고도 같은 ID 를 만들어 낼 수 있다.
// (예: 도메인 이름 → 그 도메인의 고정 ID)

/** RFC 4122 가 정한 네임스페이스 넷 */
export const NAMESPACES = [
  { key: "dns", label: "DNS (도메인)", uuid: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" },
  { key: "url", label: "URL", uuid: "6ba7b811-9dad-11d1-80b4-00c04fd430c8" },
  { key: "oid", label: "OID", uuid: "6ba7b812-9dad-11d1-80b4-00c04fd430c8" },
  { key: "x500", label: "X.500 DN", uuid: "6ba7b814-9dad-11d1-80b4-00c04fd430c8" },
];

const encoder = new TextEncoder();

function namespaceBytes(nsUuid) {
  const plain = String(nsUuid ?? "").trim().replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(plain)) {
    throw new Error("네임스페이스가 UUID 형식이 아닙니다.");
  }
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(plain.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** 해시 결과 앞 16바이트에 버전·variant 를 새겨 UUID 로 만든다 */
function nameBased(digestBytes, version) {
  const b = digestBytes.slice(0, 16);
  b[6] = (b[6] & 0x0f) | (version << 4);
  b[8] = (b[8] & 0x3f) | 0x80;
  return bytesToUuid(b);
}

function nameInput(nsUuid, name) {
  const ns = namespaceBytes(nsUuid);
  const nameBytes = encoder.encode(String(name ?? ""));
  const buf = new Uint8Array(ns.length + nameBytes.length);
  buf.set(ns);
  buf.set(nameBytes, ns.length);
  return buf;
}

/** UUID v5 — SHA-1 로 네임스페이스 + 이름을 섞는다. 이름 기반의 표준 선택지. */
export function uuidV5(namespaceUuid, name) {
  return nameBased(sha1Bytes(nameInput(namespaceUuid, name)), 5);
}

/** UUID v3 — v5 와 같은데 MD5 를 쓴다. 옛 시스템과 맞출 때만. */
export function uuidV3(namespaceUuid, name) {
  const hex = md5(nameInput(namespaceUuid, name));
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return nameBased(b, 3);
}

// ── v1 (시각 기반, 옛 방식) ────────────────────────────────

/** 1582-10-15 부터 1970-01-01 까지의 100나노초 수 */
const GREGORIAN_OFFSET = 122192928000000000n;

let v1Last = 0n;
let v1Seq = null;

/**
 * UUID v1 — 시각 + 노드 ID.
 *
 * <p>원래는 노드 ID 에 MAC 주소를 넣지만 **브라우저는 MAC 을 알 수 없다.**
 * RFC 9562 §5.1 은 그럴 때 무작위 노드를 쓰되 **멀티캐스트 비트를 세워**
 * "이건 진짜 MAC 이 아니다" 라고 표시하라고 정한다. 그대로 따른다.
 *
 * <p>새로 만들 것이라면 v7 을 쓰는 편이 낫다 — 정렬되고 시각이 표준 유닉스 시간이다.
 */
export function uuidV1(timestampMs = Date.now()) {
  // 100나노초 단위. 같은 ms 안에서도 값이 겹치지 않게 시퀀스를 올린다.
  let ts = BigInt(Math.floor(timestampMs)) * 10000n + GREGORIAN_OFFSET;
  if (ts <= v1Last) ts = v1Last + 1n;
  v1Last = ts;

  const b = randomBytes(16);
  const timeLow = Number(ts & 0xffffffffn);
  const timeMid = Number((ts >> 32n) & 0xffffn);
  const timeHi = Number((ts >> 48n) & 0x0fffn);

  b[0] = (timeLow >>> 24) & 0xff;
  b[1] = (timeLow >>> 16) & 0xff;
  b[2] = (timeLow >>> 8) & 0xff;
  b[3] = timeLow & 0xff;
  b[4] = (timeMid >>> 8) & 0xff;
  b[5] = timeMid & 0xff;
  b[6] = ((timeHi >>> 8) & 0x0f) | 0x10; // version 1
  b[7] = timeHi & 0xff;

  // clock_seq — 프로세스마다 한 번 정하고 유지한다(표준 의도)
  if (v1Seq === null) v1Seq = ((b[8] & 0x3f) << 8) | b[9];
  b[8] = ((v1Seq >> 8) & 0x3f) | 0x80; // variant 10xx
  b[9] = v1Seq & 0xff;

  b[10] |= 0x01; // 멀티캐스트 비트 — MAC 이 아니라 무작위 노드라는 표시
  return bytesToUuid(b);
}

export const UUID_KINDS = [
  { key: "v4", label: "UUID v4 (난수)", hint: "가장 흔함. 정렬 불가" },
  { key: "v7", label: "UUID v7 (시간순)", hint: "DB PK 에 유리 — 인덱스 단편화 적음" },
  { key: "v1", label: "UUID v1 (시각·옛 방식)", hint: "옛 시스템 호환용. 새로 쓸 거면 v7" },
  { key: "v3", label: "UUID v3 (이름·MD5)", hint: "같은 이름 → 같은 값. 옛 방식", needsName: true },
  { key: "v5", label: "UUID v5 (이름·SHA-1)", hint: "같은 이름 → 같은 값. 이름 기반의 표준", needsName: true },
  { key: "ulid", label: "ULID", hint: "26자 Base32, URL·파일명 안전" },
  { key: "nil", label: "NIL UUID", hint: "전부 0 — '값 없음' 표현" },
];

/**
 * 여러 개 생성.
 * @param {string} kind UUID_KINDS 의 key
 * @param {number} count
 * @param {{namespace?:string, name?:string}} [opts] 이름 기반(v3·v5)에 필요
 */
export function generateMany(kind, count, opts = {}) {
  const n = Math.max(1, Math.min(1000, Number(count) || 1));

  if (kind === "v3" || kind === "v5") {
    const { namespace, name } = opts;
    if (!namespace || name === undefined || name === null || name === "") {
      throw new Error("이름 기반 UUID 에는 네임스페이스와 이름이 필요합니다.");
    }
    // 같은 이름이면 전부 같은 값이 나온다 — 그게 이 방식의 요점이라 그대로 둔다
    const one = kind === "v5" ? uuidV5(namespace, name) : uuidV3(namespace, name);
    return Array.from({ length: n }, () => one);
  }

  const gen = {
    v4: uuidV4,
    v7: () => uuidV7(),
    v1: () => uuidV1(),
    ulid: () => ulid(),
    nil: nilUuid,
  }[kind] || uuidV4;
  return Array.from({ length: n }, gen);
}
