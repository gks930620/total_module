// JWT 서명·검증·키 생성 — 전부 클라이언트(NFR-02).
//
// 암호 연산은 브라우저 내장 Web Crypto(`crypto.subtle`)에 맡긴다. 직접 구현하지 않는다 —
// `/hash` 가 SHA 를 내장에 맡기는 것과 같은 이유다(검증된 구현을 쓰는 편이 안전하다).
//
// **비밀키·개인키가 브라우저 밖으로 나가지 않는다는 점이 이 도구의 존재 이유다.**
// 온라인 JWT 도구에 회사 토큰과 키를 붙여넣는 건 실제로 사고이고, 여기서는 구조적으로 불가능하다.

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * 다룰 수 있는 서명 알고리즘 전부.
 *
 * <p>`keyKind` 가 화면을 가른다 — `secret` 은 글자 하나, `keypair` 는 PEM 두 장이다.
 * ECDSA 서명은 Web Crypto 가 raw(r‖s)로 내는데 JWS 가 요구하는 것도 raw 라 그대로 쓴다
 * (서버 라이브러리 중에는 DER 을 쓰는 것이 있어 값이 달라 보일 수 있다).
 */
export const SIGN_ALGOS = [
  { key: "HS256", label: "HS256 · HMAC-SHA256", keyKind: "secret", family: "HMAC", hash: "SHA-256" },
  { key: "HS384", label: "HS384 · HMAC-SHA384", keyKind: "secret", family: "HMAC", hash: "SHA-384" },
  { key: "HS512", label: "HS512 · HMAC-SHA512", keyKind: "secret", family: "HMAC", hash: "SHA-512" },

  { key: "RS256", label: "RS256 · RSA-SHA256", keyKind: "keypair", family: "RSA", hash: "SHA-256" },
  { key: "RS384", label: "RS384 · RSA-SHA384", keyKind: "keypair", family: "RSA", hash: "SHA-384" },
  { key: "RS512", label: "RS512 · RSA-SHA512", keyKind: "keypair", family: "RSA", hash: "SHA-512" },

  { key: "PS256", label: "PS256 · RSA-PSS-SHA256", keyKind: "keypair", family: "RSA-PSS", hash: "SHA-256" },
  { key: "PS384", label: "PS384 · RSA-PSS-SHA384", keyKind: "keypair", family: "RSA-PSS", hash: "SHA-384" },
  { key: "PS512", label: "PS512 · RSA-PSS-SHA512", keyKind: "keypair", family: "RSA-PSS", hash: "SHA-512" },

  { key: "ES256", label: "ES256 · ECDSA P-256", keyKind: "keypair", family: "EC", hash: "SHA-256", curve: "P-256" },
  { key: "ES384", label: "ES384 · ECDSA P-384", keyKind: "keypair", family: "EC", hash: "SHA-384", curve: "P-384" },
];

const algoOf = (key) => SIGN_ALGOS.find((a) => a.key === String(key || "").toUpperCase());

/** 해시 길이(바이트) — RSA-PSS 의 salt 길이는 해시 길이와 같다(RFC 7518 §3.5) */
const HASH_BYTES = { "SHA-256": 32, "SHA-384": 48, "SHA-512": 64 };

// ── base64url ──────────────────────────────────────────────

const b64urlFromBytes = (bytes) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const b64urlFromString = (s) => b64urlFromBytes(enc.encode(s));

function bytesFromB64url(s) {
  let t = String(s).trim().replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (t.length % 4 === 1) throw new Error("base64url 길이가 올바르지 않습니다.");
  while (t.length % 4 !== 0) t += "=";
  const bin = atob(t); // 알파벳 밖 글자면 여기서 던진다
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── PEM ────────────────────────────────────────────────────

/** 바이트 → PEM. 본문은 64자마다 줄바꿈한다(표준 형태라야 다른 도구가 읽는다). */
export function toPem(bytes, label) {
  let b64 = "";
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  b64 = btoa(bin);
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/** PEM → { label, bytes }. 아니면 예외. */
export function parsePem(text) {
  const m = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(String(text || ""));
  if (!m) {
    throw new Error("PEM 형식이 아닙니다. -----BEGIN ...----- 로 시작하는 키를 넣어 주세요.");
  }
  const body = m[2].replace(/\s/g, "");
  let bytes;
  try {
    const bin = atob(body);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    throw new Error("PEM 본문을 base64 로 읽지 못했습니다.");
  }
  if (!bytes.length) throw new Error("PEM 본문이 비어 있습니다.");
  return { label: m[1], bytes };
}

const looksPem = (s) => /-----BEGIN [A-Z0-9 ]+-----/.test(String(s || ""));

// ── 키 만들기 ──────────────────────────────────────────────

/** Web Crypto 알고리즘 서술자 */
function importParams(algo) {
  if (algo.family === "RSA") return { name: "RSASSA-PKCS1-v1_5", hash: algo.hash };
  if (algo.family === "RSA-PSS") return { name: "RSA-PSS", hash: algo.hash };
  if (algo.family === "EC") return { name: "ECDSA", namedCurve: algo.curve };
  return { name: "HMAC", hash: algo.hash };
}

/** 서명할 때 넘길 파라미터 (PSS 의 salt·ECDSA 의 hash 가 여기 붙는다) */
function signParams(algo) {
  if (algo.family === "RSA-PSS") return { name: "RSA-PSS", saltLength: HASH_BYTES[algo.hash] };
  if (algo.family === "EC") return { name: "ECDSA", hash: algo.hash };
  if (algo.family === "RSA") return { name: "RSASSA-PKCS1-v1_5" };
  return { name: "HMAC" };
}

/**
 * 비밀키 문자열을 실제 키 바이트로.
 *
 * <p>**같은 문자열이라도 해석에 따라 키가 완전히 달라진다.** jwt.io 의 "Base64URL Encoded" 와
 * 같은 선택이다. 화면에서는 두 해석의 키 길이를 나란히 보여 어느 쪽인지 늘 드러나게 둔다.
 */
export function decodeSecret(secret, isBase64) {
  const s = String(secret ?? "");
  if (!isBase64) return enc.encode(s);
  try {
    return bytesFromB64url(s);
  } catch {
    throw new Error("이 문자열은 base64 로 디코드할 수 없습니다. 키 해석을 UTF-8 로 바꾸거나 값을 확인하세요.");
  }
}

// ── 비밀키의 세기 ──────────────────────────────────────────
//
// RFC 7518 §3.2 — HMAC 키는 **해시 출력과 같거나 큰 크기여야 한다(MUST)**.
// 짧은 키로도 서명 자체는 된다(Web Crypto 가 막지 않는다). 그런데 서버 라이브러리는
// 대개 거부한다(jjwt 의 WeakKeyException). 그러면 **여기서는 되는데 서버에서는 안 되고**
// 사용자는 이유를 알 수 없다 — 이 프로젝트가 계속 없애 온 "조용히 틀린" 상황이다.

/** 이 알고리즘이 요구하는 최소 키 크기(바이트). HMAC 이 아니면 null. */
export function requiredKeyBytes(alg) {
  const algo = algoOf(alg);
  if (!algo || algo.keyKind !== "secret") return null;
  return HASH_BYTES[algo.hash];
}

/**
 * 비밀키가 충분히 긴지 본다.
 * @returns {{applies:boolean, empty?:boolean, ok:boolean, bytes?:number, required?:number, reason?:string}}
 */
/**
 * 값에 눈에 안 보이는 공백이 있는지 살핀다.
 *
 * <p>서명이 안 맞는 이유의 상당수가 이것이다. 환경변수·YAML·터미널에서 키를 복사하면
 * 앞뒤 공백이나 줄 끝 개행이 딸려 온다. 화면에는 똑같아 보이는데 바이트가 달라
 * 서명은 완전히 달라진다.
 *
 * <p>**고쳐 주지는 않는다.** 공백이 진짜 키의 일부일 수도 있다. 알려만 주고 판단은 사용자 몫이다.
 *
 * @returns {{has:boolean, leading:boolean, trailing:boolean, inner:boolean,
 *            newline:boolean, leadCount:number, trailCount:number, label:string}}
 */
export function inspectWhitespace(value) {
  const s = String(value ?? "");
  const none = {
    has: false, leading: false, trailing: false, inner: false,
    newline: false, leadCount: 0, trailCount: 0, label: "",
  };
  if (!s) return none;

  const trimmed = s.trim();
  const leadCount = s.length - s.trimStart().length;
  const trailCount = s.length - s.trimEnd().length;
  const leading = leadCount > 0;
  const trailing = trailCount > 0;
  // 앞뒤를 걷어낸 뒤에도 공백이 남으면 그건 가운데 공백이다
  const inner = /\s/.test(trimmed);
  const newline = /[\r\n]/.test(s);

  if (!leading && !trailing && !inner) return none;

  const parts = [];
  if (leading) parts.push(`앞에 ${leadCount}글자`);
  if (trailing) parts.push(`뒤에 ${trailCount}글자`);
  if (inner) parts.push("가운데");

  return {
    has: true, leading, trailing, inner, newline, leadCount, trailCount,
    label: `${parts.join(" · ")} 공백이 있습니다${newline ? "(줄바꿈 포함)" : ""}.`,
  };
}

/** PEM 은 줄바꿈이 정상이라 공백 진단 대상이 아니다 */
const looksLikePem = (s) => /-----BEGIN [^-]+-----/.test(String(s ?? ""));

/** base64 로 읽어야 할 것 같은 모양인가 — 길이가 4의 배수이고 base64 알파벳뿐 */
function looksLikeBase64(s) {
  const v = String(s ?? "").trim();
  if (v.length < 16 || v.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return false;
  return v.includes("=") || /[+/]/.test(v);   // 순수 영숫자면 그냥 문자열일 가능성이 높다
}

/**
 * 서명 검증이 실패했을 때 **값을 의심하기 전에 먼저 볼 곳**을 문장으로 준다.
 *
 * <p>"서명이 맞지 않습니다" 만 띄우면 사용자는 키 자체를 의심하며 시간을 버린다.
 * 실제 원인은 대개 공백이거나 base64 해석 차이다.
 *
 * @returns {string[]} 짚어 줄 것이 없으면 빈 배열
 */
export function signatureHints({ token, secret, secretIsBase64 = false } = {}) {
  const hints = [];

  // 비밀키의 공백. PEM 은 줄바꿈이 정상이라 건너뛴다.
  if (!looksLikePem(secret)) {
    const ws = inspectWhitespace(secret);
    if (ws.has) hints.push(`비밀키 ${ws.label} 복사할 때 딸려온 것이면 지우고 다시 확인해 보세요.`);
  }

  // 토큰 안의 공백. 앞뒤는 verifyJwt 가 어차피 잘라내므로 **가운데만** 본다.
  const innerToken = inspectWhitespace(String(token ?? "").trim());
  if (innerToken.inner) {
    hints.push(
      `토큰 가운데에 ${innerToken.newline ? "줄바꿈" : "공백"}이 있습니다. ` +
      "붙여넣을 때 줄이 접힌 경우가 많습니다 — 한 줄로 이어 붙여 보세요."
    );
  }

  // 같은 문자열이라도 글자로 읽느냐 base64 로 읽느냐에 따라 서명이 완전히 달라진다
  if (!secretIsBase64 && !looksLikePem(secret) && looksLikeBase64(secret)) {
    hints.push(
      "비밀키가 Base64 문자열처럼 보입니다. 서버가 Decoders.BASE64.decode(secret) 로 읽는다면 " +
      "'Base64 로 인코딩된 키' 를 켜야 같은 서명이 나옵니다."
    );
  }

  return hints;
}

export function checkSecretStrength(alg, secret, isBase64 = false) {
  const required = requiredKeyBytes(alg);
  if (required === null) return { applies: false, ok: true };
  if (!String(secret ?? "")) return { applies: true, empty: true, ok: false, required };

  let bytes;
  try {
    bytes = decodeSecret(secret, isBase64).length;
  } catch (e) {
    return { applies: true, ok: false, required, reason: e.message };
  }

  if (bytes >= required) return { applies: true, ok: true, bytes, required };
  return {
    applies: true,
    ok: false,
    bytes,
    required,
    reason: `${alg} 는 ${required}바이트 이상이 필요합니다(RFC 7518 §3.2). 현재 ${bytes}바이트 — jjwt 등은 WeakKeyException 으로 거부합니다.`,
  };
}

/**
 * 쓸 만한 비밀키를 만들어 준다.
 *
 * <p>요구 크기만큼의 난수를 base64url 로 낸다. 그래서 **서버가 글자 그대로 읽든
 * base64 로 디코드해서 읽든 둘 다 요구 크기를 넘는다** — 어느 쪽 코드든 안전하다.
 * 글자도 base64url 알파벳뿐이라 환경변수·YAML 에 따옴표 없이 그대로 넣을 수 있다.
 */
export function generateSecret(alg = "HS256") {
  const required = requiredKeyBytes(alg);
  if (required === null) {
    throw new Error(`${alg} 는 비밀키가 아니라 키쌍을 씁니다. '키쌍 만들기' 를 쓰세요.`);
  }
  const raw = new Uint8Array(required);
  crypto.getRandomValues(raw);
  return b64urlFromBytes(raw);
}

/**
 * 알고리즘에 맞는 키쌍을 만들어 PEM 두 장으로 준다.
 * @returns {Promise<{privatePem:string, publicPem:string}>}
 */
export async function generateKeyPair(alg) {
  const algo = algoOf(alg);
  if (!algo) throw new Error(`${alg} 은(는) 지원하지 않는 알고리즘입니다.`);
  if (algo.keyKind !== "keypair") {
    throw new Error(`${algo.key} 는 비밀키 하나만 쓰는 방식이라 키쌍이 없습니다.`);
  }

  const params = algo.family === "EC"
    ? { name: "ECDSA", namedCurve: algo.curve }
    : {
      name: algo.family === "RSA-PSS" ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: algo.hash,
    };

  const pair = await crypto.subtle.generateKey(params, true, ["sign", "verify"]);
  const [priv, pub] = await Promise.all([
    crypto.subtle.exportKey("pkcs8", pair.privateKey),
    crypto.subtle.exportKey("spki", pair.publicKey),
  ]);
  return {
    privatePem: toPem(new Uint8Array(priv), "PRIVATE KEY"),
    publicPem: toPem(new Uint8Array(pub), "PUBLIC KEY"),
  };
}

/** PEM(또는 비밀키 문자열) → CryptoKey */
async function importKey(algo, key, { usage, secretIsBase64 }) {
  const wantPrivate = usage === "sign";

  if (algo.keyKind === "secret") {
    if (looksPem(key)) {
      throw new Error(`${algo.key} 는 비밀키 문자열을 씁니다. PEM 키를 쓰려면 RS·PS·ES 알고리즘을 고르세요.`);
    }
    const raw = decodeSecret(key, secretIsBase64);
    if (!raw.length) throw new Error("비밀키를 입력해 주세요.");
    return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: algo.hash }, false, [usage]);
  }

  if (!looksPem(key)) {
    throw new Error(`${algo.key} 는 PEM 키가 필요합니다. -----BEGIN ...----- 로 시작하는 키를 넣어 주세요.`);
  }
  const { label, bytes } = parsePem(key);
  const isPrivatePem = /PRIVATE/.test(label);

  if (wantPrivate && !isPrivatePem) {
    throw new Error("서명에는 개인키(PRIVATE KEY)가 필요합니다. 지금 넣은 것은 공개키입니다.");
  }

  // 검증에 개인키를 준 경우 — 개인키만 들고 있을 때가 흔하므로 받아 준다
  const format = isPrivatePem ? "pkcs8" : "spki";
  const usages = isPrivatePem ? ["sign"] : ["verify"];
  try {
    const imported = await crypto.subtle.importKey(format, bytes, importParams(algo), false, usages);
    if (!wantPrivate && isPrivatePem) return { key: imported, derivedFromPrivate: true };
    return imported;
  } catch {
    throw new Error(`이 키를 ${algo.key} 용으로 읽지 못했습니다. 알고리즘과 키 종류가 맞는지 확인해 주세요.`);
  }
}

// ── 서명 · 검증 ────────────────────────────────────────────

/**
 * 헤더·페이로드를 서명해 토큰을 만든다.
 *
 * @param {object}  o
 * @param {object} [o.header] 없으면 { alg, typ:"JWT" } 를 만들어 쓴다
 * @param {object}  o.payload
 * @param {string} [o.secret] HS* 용 비밀키
 * @param {string} [o.key] 비밀키(HS) 또는 PEM 개인키(RS·PS·ES). secret 보다 우선한다
 * @param {string} [o.alg="HS256"]
 * @param {boolean}[o.secretIsBase64=false] 비밀키를 base64url 바이트로 볼지
 * @returns {Promise<string>} 완성된 JWT
 */
export async function signJwt({ header, payload, secret, key, alg, secretIsBase64 = false }) {
  const chosen = String(header?.alg || alg || "HS256").toUpperCase();
  const algo = algoOf(chosen);
  if (!algo) {
    throw new Error(`${chosen} 은(는) 지원하지 않는 알고리즘입니다.`);
  }

  // ⚠️ 서명 대상은 **인코딩된 문자열**이라 키 순서가 바뀌면 서명도 바뀐다.
  // 사용자가 쓴 헤더를 재배열하지 않고, 없는 항목만 뒤에 채운다.
  // (예전엔 typ 를 앞으로 밀어 넣어 jwt.io 와 값이 달랐다)
  const head = { ...(header || {}) };
  if (head.alg === undefined) head.alg = chosen;
  if (head.typ === undefined) head.typ = "JWT";

  const signingInput = `${b64urlFromString(JSON.stringify(head))}.${b64urlFromString(JSON.stringify(payload ?? {}))}`;
  const cryptoKey = await importKey(algo, key ?? secret, { usage: "sign", secretIsBase64 });
  const sig = new Uint8Array(await crypto.subtle.sign(signParams(algo), cryptoKey, enc.encode(signingInput)));
  return `${signingInput}.${b64urlFromBytes(sig)}`;
}

/**
 * 시각 클레임을 본다 — **서명이 맞는 것과 지금 써도 되는 것은 다른 문제다.**
 * exp 를 확인하지 않는 구현이 실제로 흔한 취약점이라 따로 떼어 뒀다.
 */
export function checkClaims(payload, { now = Math.floor(Date.now() / 1000), skew = 60 } = {}) {
  const problems = [];
  let expired = false;
  let notYet = false;

  const num = (k) => {
    const v = payload?.[k];
    if (v === undefined) return null;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      problems.push(`${k} 가 숫자가 아닙니다 — Unix 초여야 합니다.`);
      return null;
    }
    return v;
  };

  const exp = num("exp");
  if (exp !== null && now > exp) { expired = true; problems.push("만료된 토큰입니다 (exp 가 지났습니다)."); }

  const nbf = num("nbf");
  if (nbf !== null && now + skew < nbf) { notYet = true; problems.push("아직 유효하지 않습니다 (nbf 가 미래입니다)."); }

  const iat = num("iat");
  if (iat !== null && iat > now + skew) problems.push("발급 시각(iat)이 미래입니다.");

  return { problems, expired, notYet };
}

/**
 * 토큰의 서명이 이 키로 만들어진 것인지 확인한다.
 *
 * <p>결과를 세 가지로 나눈다 — **"틀렸다" 와 "모른다" 는 다르다.**
 * 못 다루는 알고리즘에 "서명이 맞지 않습니다" 라고 하면 위조라는 뜻으로 읽힌다.
 *
 * @returns {Promise<{valid:boolean, reason?:string, alg?:string, unsupported?:boolean,
 *                    needsKey?:boolean, claims?:object}>}
 */
export async function verifyJwt(token, key, { secretIsBase64 = false, now } = {}) {
  const parts = String(token || "").trim().split(".");
  if (parts.length !== 3) {
    return { valid: false, reason: "JWT 형식이 아닙니다. header.payload.signature 구조를 확인하세요." };
  }
  const [h, p, sig] = parts;

  let head;
  let body;
  try {
    head = JSON.parse(dec.decode(bytesFromB64url(h)));
  } catch {
    return { valid: false, reason: "헤더를 읽을 수 없습니다." };
  }
  try {
    body = JSON.parse(dec.decode(bytesFromB64url(p)));
  } catch {
    body = null;
  }
  const claims = body ? checkClaims(body, now === undefined ? {} : { now }) : undefined;

  const alg = String(head?.alg || "").toUpperCase();
  if (alg === "NONE") {
    return {
      valid: false,
      alg: head.alg,
      claims,
      reason: "alg 가 none 입니다 — 서명이 없는 토큰은 누구나 만들 수 있으므로 신뢰하면 안 됩니다.",
    };
  }
  if (!sig) {
    return { valid: false, alg: head.alg, claims, reason: "서명이 비어 있어 확인할 것이 없습니다." };
  }

  const algo = algoOf(alg);
  if (!algo) {
    return {
      valid: false,
      alg: head.alg,
      unsupported: true,
      claims,
      reason: `${head.alg || "알 수 없는 알고리즘"} 은(는) 확인할 수 없습니다. 서명이 틀렸다는 뜻은 아닙니다.`,
    };
  }
  if (!String(key ?? "")) {
    return {
      valid: false,
      alg: head.alg,
      needsKey: true,
      claims,
      reason: algo.keyKind === "secret" ? "비밀키를 넣으면 서명을 확인합니다." : "공개키(PEM)를 넣으면 서명을 확인합니다.",
    };
  }

  try {
    const imported = await importKey(algo, key, { usage: "verify", secretIsBase64 });
    // 개인키를 넣은 경우엔 그것으로 다시 서명해 비교한다(공개키를 뽑아내는 표준 API 가 없다)
    if (imported?.derivedFromPrivate) {
      const again = new Uint8Array(await crypto.subtle.sign(signParams(algo), imported.key, enc.encode(`${h}.${p}`)));
      const ok = b64urlFromBytes(again) === sig.replace(/=+$/, "");
      return ok
        ? { valid: true, alg: head.alg, claims }
        : { valid: false, alg: head.alg, claims, reason: "서명이 이 키와 맞지 않습니다." };
    }
    const ok = await crypto.subtle.verify(signParams(algo), imported, bytesFromB64url(sig), enc.encode(`${h}.${p}`));
    return ok
      ? { valid: true, alg: head.alg, claims }
      : { valid: false, alg: head.alg, claims, reason: "서명이 이 키와 맞지 않습니다." };
  } catch (e) {
    return { valid: false, alg: head.alg, claims, reason: e.message || "서명을 확인하지 못했습니다." };
  }
}
