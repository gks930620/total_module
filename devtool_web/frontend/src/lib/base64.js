// Base64 / JWT 유틸 (B64-01~05) — 전부 클라이언트, 서버 전송 없음.

// UTF-8 안전 인코딩: 문자열 -> Base64
export function encodeBase64(str, urlSafe = false) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  let b64 = btoa(binary);
  if (urlSafe) b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return b64;
}

// URL-safe Base64 자동 감지: '-' 또는 '_' 포함, 혹은 '+' '/' 없음
export function looksUrlSafe(input) {
  return /[-_]/.test(input) && !/[+/]/.test(input);
}

/** Base64(표준·URL-safe 모두) -> 바이트. 읽을 수 없으면 예외. */
function base64ToBytes(input) {
  // 줄바꿈이 든 형태(PEM·메일 헤더)를 그대로 받아 준다
  let s = String(input ?? "").trim().replace(/\s/g, "");
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  // 길이를 4 로 나눈 나머지가 1인 Base64 는 존재할 수 없다 — 패딩으로 덮지 말고 거절한다
  if (s.length % 4 === 1) throw new Error("Base64 길이가 올바르지 않습니다.");
  while (s.length % 4 !== 0) s += "=";

  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// UTF-8 안전 디코딩: Base64(표준/URL-safe 모두) -> 문자열. 실패 시 예외.
export function decodeBase64(input) {
  return new TextDecoder("utf-8", { fatal: false }).decode(base64ToBytes(input));
}

/**
 * 화면용 디코드 — 결과가 **텍스트가 아닐 수도 있다**는 사실을 함께 돌려준다.
 *
 * <p>`decodeBase64` 는 UTF-8 로 읽을 수 없는 바이트를 (fatal:false 라) 조용히 `�` 로 바꾼다.
 * 이미지나 바이너리를 Base64 로 받아 넣으면 화면에는 깨진 글자만 남고, 사용자는
 * **자기가 잘못 넣은 건지 원래 그런 데이터인지 구분할 수 없다.** 그래서 판단 재료를 같이 준다.
 *
 * @returns {{ok:boolean, reason?:string, text?:string, isText?:boolean, byteLength?:number, hex?:string}}
 */
export function decodeBase64Info(input) {
  let bytes;
  try {
    bytes = base64ToBytes(input);
  } catch (e) {
    return { ok: false, reason: e.message || "Base64 로 읽을 수 없습니다." };
  }

  // fatal:true 로 한 번 더 읽어 본다 — 여기서 던지면 UTF-8 텍스트가 아니라는 뜻이다
  let isText = true;
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    isText = false;
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  const head = Array.from(bytes.slice(0, 32), (b) => b.toString(16).padStart(2, "0")).join(" ");
  return {
    ok: true,
    text,
    isText,
    byteLength: bytes.length,
    hex: bytes.length > 32 ? `${head} …` : head,
  };
}

function decodeSegment(seg) {
  return decodeBase64(seg);
}

// JWT 파싱: header/payload 디코드. 서명은 검증하지 않는다(B64-05).
export function parseJwt(token) {
  const t = (token || "").trim();
  const parts = t.split(".");
  if (parts.length < 2) {
    throw new Error("JWT 형식이 아닙니다. header.payload.signature 구조를 확인하세요.");
  }
  let header;
  let payload;
  try {
    header = JSON.parse(decodeSegment(parts[0]));
  } catch {
    throw new Error("header(첫 번째 세그먼트)를 JSON으로 디코드할 수 없습니다.");
  }
  try {
    payload = JSON.parse(decodeSegment(parts[1]));
  } catch {
    throw new Error("payload(두 번째 세그먼트)를 JSON으로 디코드할 수 없습니다.");
  }
  return {
    header,
    payload,
    signature: parts[2] || "",
    hasSignature: Boolean(parts[2]),
  };
}

// exp/iat/nbf 초 단위 유닉스 타임스탬프 -> KST 사람 읽는 시각 (B64-04)
export function unixToKst(sec) {
  if (typeof sec !== "number" || !Number.isFinite(sec)) return null;
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} KST`;
}

// exp 기준 만료 여부. exp 없으면 null.
export function isExpired(payload) {
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp * 1000 < Date.now();
}
