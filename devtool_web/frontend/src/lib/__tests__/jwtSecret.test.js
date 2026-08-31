// 비밀키 세기 검사 · 무작위 비밀키 생성 계약 테스트 — 구현 전 선작성(Red).
//
// RFC 7518 §3.2: HMAC 키는 **해시 출력과 같거나 큰 크기여야 한다(MUST)**.
// 짧은 키로도 서명 자체는 되지만, 서버(jjwt 등)가 WeakKeyException 으로 거부한다 —
// "여기서는 되는데 서버에서 안 되는" 상황이 되고 사용자는 이유를 모른다.
import { describe, it, expect } from "vitest";
import { checkSecretStrength, generateSecret, requiredKeyBytes, signJwt, verifyJwt } from "../jwt.js";

describe("requiredKeyBytes — 알고리즘마다 요구 크기", () => {
  it.each([["HS256", 32], ["HS384", 48], ["HS512", 64]])("%s 는 %i바이트", (alg, bytes) => {
    expect(requiredKeyBytes(alg)).toBe(bytes);
  });

  it("공개키 계열은 해당 없음", () => {
    expect(requiredKeyBytes("RS256")).toBeNull();
    expect(requiredKeyBytes("ES256")).toBeNull();
  });
});

describe("checkSecretStrength — 짧으면 짧다고 말한다", () => {
  it("짧은 키를 잡아낸다", () => {
    const r = checkSecretStrength("HS256", "abc", false);
    expect(r.ok).toBe(false);
    expect(r.bytes).toBe(3);
    expect(r.required).toBe(32);
    expect(r.reason).toMatch(/32|바이트/);
  });

  it("충분히 긴 키는 통과한다", () => {
    expect(checkSecretStrength("HS256", "a-string-secret-at-least-256-bits-long", false).ok).toBe(true);
  });

  it("한글은 UTF-8 바이트로 센다 — 글자 수가 아니다", () => {
    // 한글 11자 = 33바이트 ≥ 32
    expect(checkSecretStrength("HS256", "가".repeat(11), false).bytes).toBe(33);
    expect(checkSecretStrength("HS256", "가".repeat(11), false).ok).toBe(true);
    // 한글 10자 = 30바이트 < 32
    expect(checkSecretStrength("HS256", "가".repeat(10), false).ok).toBe(false);
  });

  it("base64 로 읽으면 디코드한 바이트 수로 센다", () => {
    // 43자 base64url = 32바이트
    const b64 = generateSecret("HS256");
    expect(checkSecretStrength("HS256", b64, true).bytes).toBe(32);
    expect(checkSecretStrength("HS256", b64, true).ok).toBe(true);
  });

  it("HS512 는 더 긴 키를 요구한다", () => {
    const k = "a".repeat(40);
    expect(checkSecretStrength("HS256", k, false).ok).toBe(true);
    expect(checkSecretStrength("HS512", k, false).ok).toBe(false);
  });

  it("공개키 계열에는 해당 없다고 한다", () => {
    expect(checkSecretStrength("RS256", "무엇이든", false).applies).toBe(false);
  });

  it("비어 있으면 판정하지 않는다", () => {
    expect(checkSecretStrength("HS256", "", false).empty).toBe(true);
  });

  it("base64 로 읽을 수 없는 값이면 알려 준다", () => {
    const r = checkSecretStrength("HS256", "한글!!", true);
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });
});

describe("generateSecret — 만들어 주는 키는 어느 쪽으로 읽어도 안전하다", () => {
  it.each(["HS256", "HS384", "HS512"])("%s 용 키를 만든다", (alg) => {
    const s = generateSecret(alg);
    // 글자 그대로 읽어도, base64 로 디코드해서 읽어도 요구 크기를 넘는다.
    // 서버가 어느 쪽으로 읽든 WeakKeyException 이 나지 않는다.
    expect(checkSecretStrength(alg, s, false).ok, `${alg} 문자 해석`).toBe(true);
    expect(checkSecretStrength(alg, s, true).ok, `${alg} base64 해석`).toBe(true);
  });

  it("base64url 글자만 쓴다 — 설정 파일·환경변수에 그대로 넣을 수 있어야 한다", () => {
    expect(generateSecret("HS256")).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("매번 다르다", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateSecret("HS256")));
    expect(set.size).toBe(200);
  });

  it("만든 키로 바로 서명하고 검증할 수 있다", async () => {
    const secret = generateSecret("HS256");
    const token = await signJwt({ payload: { a: 1 }, key: secret, alg: "HS256" });
    expect((await verifyJwt(token, secret)).valid).toBe(true);
  });

  it("공개키 계열에는 만들어 주지 않는다 — 거기는 키쌍이다", () => {
    expect(() => generateSecret("RS256")).toThrow();
  });
});
