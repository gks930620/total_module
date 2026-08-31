// JWT 서명·검증 계약 테스트 — 구현 전 선작성(Red).
//
// 기준값은 jwt.io 의 예시 토큰이다. 남의 구현과 값이 맞아야 쓸모가 있으므로
// "우리끼리 왕복되면 통과" 로 두지 않고 **바깥 기준값에 고정**한다.
import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt, SIGN_ALGOS, decodeSecret } from "../jwt.js";

// jwt.io 기본 예시
const HEADER = { alg: "HS256", typ: "JWT" };
const PAYLOAD = { sub: "1234567890", name: "John Doe", admin: true, iat: 1516239022 };
const SECRET = "a-string-secret-at-least-256-bits-long";

const TOKEN_TEXT_SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0" +
  ".KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30";

// 같은 비밀키 문자열을 base64url 로 **디코드해서** 바이트로 쓴 경우
const SIG_BYTES_SECRET = "bvaCw_BcATkKA_uogsqM13JqIpsXjBXMpMGJNmZPCOQ";

describe("SIGN_ALGOS", () => {
  it("HMAC 계열 세 가지가 들어 있다 (전체 목록은 jwtKeys.test.js 가 잠근다)", () => {
    expect(SIGN_ALGOS.filter((a) => a.keyKind === "secret").map((a) => a.key))
      .toEqual(["HS256", "HS384", "HS512"]);
  });

  it("항목마다 화면에 쓸 이름이 있다", () => {
    for (const a of SIGN_ALGOS) expect(String(a.label || "").trim()).not.toBe("");
  });
});

describe("signJwt — 남의 구현과 값이 맞는다", () => {
  it("jwt.io 예시 토큰을 그대로 만들어 낸다", async () => {
    const token = await signJwt({ header: HEADER, payload: PAYLOAD, secret: SECRET });
    expect(token).toBe(TOKEN_TEXT_SECRET);
  });

  it("비밀키를 base64url 로 보면 서명이 달라진다", async () => {
    const token = await signJwt({ header: HEADER, payload: PAYLOAD, secret: SECRET, secretIsBase64: true });
    expect(token.split(".")[2]).toBe(SIG_BYTES_SECRET);
  });

  it("alg 를 지정하면 헤더에 반영된다", async () => {
    const token = await signJwt({ payload: { a: 1 }, secret: "k", alg: "HS512" });
    const header = JSON.parse(atob(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")));
    expect(header.alg).toBe("HS512");
    expect(header.typ).toBe("JWT");
  });

  it("HS384 · HS512 도 만든다", async () => {
    for (const alg of ["HS384", "HS512"]) {
      const token = await signJwt({ payload: { a: 1 }, secret: "k", alg });
      expect((await verifyJwt(token, "k")).valid, alg).toBe(true);
    }
  });

  it("비밀키가 비면 거절한다", async () => {
    await expect(signJwt({ payload: { a: 1 }, secret: "" })).rejects.toThrow();
  });

  it("모르는 알고리즘은 거절한다", async () => {
    await expect(signJwt({ payload: { a: 1 }, secret: "k", alg: "EdDSA" })).rejects.toThrow();
  });

  it("RS256 에 비밀키 문자열을 주면 PEM 이 필요하다고 알려 준다", async () => {
    await expect(signJwt({ payload: { a: 1 }, secret: "k", alg: "RS256" })).rejects.toThrow(/PEM/);
  });

  it("한글 페이로드도 만든다", async () => {
    const token = await signJwt({ payload: { name: "홍길동" }, secret: "비밀키" });
    expect((await verifyJwt(token, "비밀키")).valid).toBe(true);
  });
});

describe("verifyJwt — 맞으면 맞다고, 틀리면 틀리다고", () => {
  it("올바른 비밀키면 통과한다", async () => {
    const r = await verifyJwt(TOKEN_TEXT_SECRET, SECRET);
    expect(r.valid).toBe(true);
  });

  it("비밀키가 다르면 실패한다", async () => {
    const r = await verifyJwt(TOKEN_TEXT_SECRET, "wrong-secret");
    expect(r.valid).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("같은 비밀키라도 base64url 로 보면 실패한다 (jwt.io 에서 헷갈리는 그 지점)", async () => {
    const r = await verifyJwt(TOKEN_TEXT_SECRET, SECRET, { secretIsBase64: true });
    expect(r.valid).toBe(false);
  });

  it("페이로드가 한 글자만 바뀌어도 실패한다", async () => {
    const [h, p, s] = TOKEN_TEXT_SECRET.split(".");
    const tampered = [h, p.slice(0, -1) + (p.slice(-1) === "0" ? "1" : "0"), s].join(".");
    expect((await verifyJwt(tampered, SECRET)).valid).toBe(false);
  });

  it("서명이 없으면 검증할 것이 없다고 알린다", async () => {
    const [h, p] = TOKEN_TEXT_SECRET.split(".");
    const r = await verifyJwt(`${h}.${p}.`, SECRET);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/서명/);
  });

  it("alg 가 none 이면 통과시키지 않는다", async () => {
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const t = `${b64({ alg: "none", typ: "JWT" })}.${b64({ a: 1 })}.`;
    const r = await verifyJwt(t, SECRET);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/none/i);
  });

  it("우리가 못 다루는 알고리즘은 '틀렸다'가 아니라 '모른다'고 한다", async () => {
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    // EdDSA 는 Web Crypto 표준에 아직 없어 우리가 다루지 못한다
    const t = `${b64({ alg: "EdDSA", typ: "JWT" })}.${b64({ a: 1 })}.AAAA`;
    const r = await verifyJwt(t, SECRET);
    expect(r.valid).toBe(false);
    expect(r.unsupported).toBe(true);
  });

  it("JWT 가 아니면 이유를 알려 준다", async () => {
    const r = await verifyJwt("이건 토큰이 아니다", SECRET);
    expect(r.valid).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("비밀키가 비면 검증을 시도하지 않는다", async () => {
    const r = await verifyJwt(TOKEN_TEXT_SECRET, "");
    expect(r.valid).toBe(false);
    expect(r.needsKey).toBe(true);
  });
});

describe("decodeSecret — 비밀키를 무엇으로 읽나", () => {
  it("문자로 읽으면 UTF-8 바이트다", () => {
    expect(Array.from(decodeSecret("abc", false))).toEqual([97, 98, 99]);
  });

  it("base64url 로 읽으면 디코드한 바이트다", () => {
    expect(Array.from(decodeSecret("//8=", true))).toEqual([255, 255]);
  });

  it("base64url 로 읽을 수 없으면 알려 준다", () => {
    expect(() => decodeSecret("한글!!", true)).toThrow();
  });
});

describe("만들고 바로 검증하기", () => {
  it("만든 토큰은 같은 비밀키로 검증된다 (해석 방식까지 같을 때)", async () => {
    for (const secretIsBase64 of [false, true]) {
      const secret = secretIsBase64 ? "c2VjcmV0LWtleQ" : "secret-key";
      const token = await signJwt({ payload: { a: 1 }, secret, secretIsBase64 });
      expect((await verifyJwt(token, secret, { secretIsBase64 })).valid, String(secretIsBase64)).toBe(true);
    }
  });
});
