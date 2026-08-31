// Base64/JWT 유틸 회귀 테스트 (B64-01~05).
import { describe, it, expect } from "vitest";
import { encodeBase64, decodeBase64, decodeBase64Info, looksUrlSafe, parseJwt, unixToKst, isExpired } from "../base64.js";

describe("encodeBase64 / decodeBase64", () => {
  it("UTF-8 한글을 라운드트립한다 (B64-01)", () => {
    const src = "한글 테스트 ✓ ABC 123";
    expect(decodeBase64(encodeBase64(src))).toBe(src);
  });

  it("표준 Base64를 인코드한다", () => {
    expect(encodeBase64("hello")).toBe("aGVsbG8=");
    expect(decodeBase64("aGVsbG8=")).toBe("hello");
  });

  it("URL-safe 모드는 +/= 를 -_ 로 바꾸고 패딩을 제거한다 (B64-02)", () => {
    const urlSafe = encodeBase64("subjects?_d", true);
    expect(urlSafe).not.toMatch(/[+/=]/);
    expect(decodeBase64(urlSafe)).toBe("subjects?_d");
  });

  it("패딩 없는 입력도 보정해 디코드한다", () => {
    expect(decodeBase64("aGVsbG8")).toBe("hello");
  });
});

describe("looksUrlSafe", () => {
  it("-_ 가 있고 +/ 가 없으면 URL-safe로 판단한다", () => {
    expect(looksUrlSafe("aGVs-bG8_")).toBe(true);
    expect(looksUrlSafe("aGVs+bG8/")).toBe(false);
  });
});

describe("parseJwt (B64-03/05)", () => {
  // header {"alg":"HS256","typ":"JWT"} / payload {"sub":"1234567890","name":"John Doe","iat":1516239022}
  const JWT =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ." +
    "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

  it("header/payload를 디코드하고 서명은 검증하지 않는다", () => {
    const r = parseJwt(JWT);
    expect(r.header.alg).toBe("HS256");
    expect(r.payload.name).toBe("John Doe");
    expect(r.payload.iat).toBe(1516239022);
    expect(r.hasSignature).toBe(true);
  });

  it("JWT 형식이 아니면 한국어 오류를 던진다", () => {
    expect(() => parseJwt("not-a-jwt")).toThrow(/JWT 형식/);
  });
});

describe("unixToKst (B64-04)", () => {
  it("유닉스 초를 KST 시각 문자열로 변환한다", () => {
    expect(unixToKst(0)).toBe("1970-01-01 09:00:00 KST");
    expect(unixToKst(1516239022)).toBe("2018-01-18 10:30:22 KST");
  });

  it("숫자가 아니면 null", () => {
    expect(unixToKst("abc")).toBeNull();
    expect(unixToKst(NaN)).toBeNull();
  });
});

describe("isExpired", () => {
  it("exp가 과거면 true, 미래면 false, 없으면 null", () => {
    expect(isExpired({ exp: 1 })).toBe(true);
    expect(isExpired({ exp: Math.floor(Date.now() / 1000) + 3600 })).toBe(false);
    expect(isExpired({})).toBeNull();
  });
});

// ── 전수 감사에서 나온 것들 ────────────────────────────────
describe("decodeBase64 — 아닌 것을 아니라고 말한다", () => {
  it("Base64 가 될 수 없는 길이를 거절한다", () => {
    // 4로 나눈 나머지가 1인 길이는 Base64 로 만들어질 수 없다
    for (const bad of ["A", "ABCDE", "AAAAAAAAA"]) {
      expect(() => decodeBase64(bad), bad).toThrow();
    }
  });

  it("Base64 알파벳이 아닌 글자를 거절한다", () => {
    for (const bad of ["한글", "ab!c", "AB CD@"]) {
      expect(() => decodeBase64(bad), bad).toThrow();
    }
  });

  it("공백·줄바꿈은 무시한다 (줄바꿈이 든 PEM 스타일을 받아 준다)", () => {
    const src = "한글 테스트";
    const enc = encodeBase64(src);
    const wrapped = enc.slice(0, 4) + "\n" + enc.slice(4);
    expect(decodeBase64(wrapped)).toBe(src);
  });
});

describe("decodeBase64Info — 텍스트가 아닌 데이터를 알려 준다", () => {
  it("텍스트면 그대로 준다", () => {
    const r = decodeBase64Info(encodeBase64("한글 abc"));
    expect(r.ok).toBe(true);
    expect(r.isText).toBe(true);
    expect(r.text).toBe("한글 abc");
  });

  it("UTF-8 로 읽을 수 없으면 isText 가 false 다", () => {
    // 0xFF 는 UTF-8 에서 단독으로 올 수 없는 바이트다
    const r = decodeBase64Info("//8=");
    expect(r.ok).toBe(true);
    expect(r.isText).toBe(false);
  });

  it("바이트 수를 함께 준다 — 원본이 파일이었는지 가늠할 수 있다", () => {
    expect(decodeBase64Info(encodeBase64("abc")).byteLength).toBe(3);
    expect(decodeBase64Info(encodeBase64("한")).byteLength).toBe(3);
  });

  it("16진 미리보기를 준다 — 텍스트가 아닐 때 볼 것이 있어야 한다", () => {
    expect(decodeBase64Info("//8=").hex).toBe("ff ff");
  });

  it("잘못된 입력은 ok:false 와 이유를 준다 (예외를 던지지 않는다)", () => {
    const r = decodeBase64Info("한글");
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });
});
