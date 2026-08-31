// JWT 공개키 계열(RS·PS·ES) + 키 생성 + 클레임 검증 계약 테스트 — 구현 전 선작성(Red).
//
// HMAC 은 jwt.test.js 가 다룬다. 여기서는 "키를 PEM 으로 주고받는" 쪽을 잠근다.
import { describe, it, expect } from "vitest";
import {
  signJwt, verifyJwt, SIGN_ALGOS, generateKeyPair, parsePem, toPem, checkClaims,
} from "../jwt.js";

const PAYLOAD = { sub: "1234567890", name: "홍길동", admin: true };
const PUBLIC_ALGS = ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384"];

describe("SIGN_ALGOS — 다룰 수 있는 것 전부", () => {
  it("HMAC · RSA · RSA-PSS · ECDSA 를 모두 제공한다", () => {
    expect(SIGN_ALGOS.map((a) => a.key)).toEqual([
      "HS256", "HS384", "HS512",
      "RS256", "RS384", "RS512",
      "PS256", "PS384", "PS512",
      "ES256", "ES384",
    ]);
  });

  it("항목마다 화면에 쓸 이름과 키 종류가 있다", () => {
    for (const a of SIGN_ALGOS) {
      expect(String(a.label || "").trim(), a.key).not.toBe("");
      expect(["secret", "keypair"], a.key).toContain(a.keyKind);
    }
  });

  it("HS 만 비밀키를 쓰고 나머지는 키쌍을 쓴다", () => {
    for (const a of SIGN_ALGOS) {
      expect(a.keyKind, a.key).toBe(a.key.startsWith("HS") ? "secret" : "keypair");
    }
  });
});

describe("generateKeyPair — 키쌍을 만들어 PEM 으로 준다", () => {
  it.each(PUBLIC_ALGS)("%s 키쌍을 만든다", async (alg) => {
    const { privatePem, publicPem } = await generateKeyPair(alg);
    expect(privatePem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    expect(privatePem.trimEnd()).toMatch(/-----END PRIVATE KEY-----$/);
    expect(publicPem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    expect(publicPem.trimEnd()).toMatch(/-----END PUBLIC KEY-----$/);
  });

  it("PEM 은 64자마다 줄바꿈한다 (표준 형태라야 다른 도구가 읽는다)", async () => {
    const { publicPem } = await generateKeyPair("ES256");
    const body = publicPem.split("\n").slice(1, -2);
    for (const line of body) expect(line.length).toBeLessThanOrEqual(64);
  });

  it("HMAC 은 키쌍이 없다고 알려 준다", async () => {
    await expect(generateKeyPair("HS256")).rejects.toThrow();
  });
});

describe("PEM 읽고 쓰기", () => {
  it("만든 PEM 을 다시 읽을 수 있다", async () => {
    const { publicPem } = await generateKeyPair("ES256");
    const parsed = parsePem(publicPem);
    expect(parsed.label).toBe("PUBLIC KEY");
    expect(parsed.bytes.length).toBeGreaterThan(0);
  });

  it("바이트 → PEM → 바이트가 그대로다", () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 251, 252]);
    expect(Array.from(parsePem(toPem(bytes, "PUBLIC KEY")).bytes)).toEqual([1, 2, 3, 250, 251, 252]);
  });

  it("PEM 이 아니면 이유를 알려 준다", () => {
    expect(() => parsePem("그냥 문자열")).toThrow();
    expect(() => parsePem("-----BEGIN PUBLIC KEY-----\n한글!!\n-----END PUBLIC KEY-----")).toThrow();
  });
});

describe("공개키 계열 서명 · 검증", () => {
  it.each(PUBLIC_ALGS)("%s 로 서명하고 공개키로 검증한다", async (alg) => {
    const { privatePem, publicPem } = await generateKeyPair(alg);
    const token = await signJwt({ payload: PAYLOAD, key: privatePem, alg });

    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"))).alg).toBe(alg);

    const r = await verifyJwt(token, publicPem);
    expect(r.valid, alg).toBe(true);
    expect(r.alg).toBe(alg);
  });

  it("다른 키쌍의 공개키로는 검증되지 않는다", async () => {
    const a = await generateKeyPair("RS256");
    const b = await generateKeyPair("RS256");
    const token = await signJwt({ payload: PAYLOAD, key: a.privatePem, alg: "RS256" });
    expect((await verifyJwt(token, b.publicPem)).valid).toBe(false);
  });

  it("내용이 한 글자만 바뀌어도 검증에 실패한다", async () => {
    const { privatePem, publicPem } = await generateKeyPair("ES256");
    const token = await signJwt({ payload: PAYLOAD, key: privatePem, alg: "ES256" });
    const [h, p, s] = token.split(".");
    const tampered = [h, p.slice(0, -1) + (p.slice(-1) === "A" ? "B" : "A"), s].join(".");
    expect((await verifyJwt(tampered, publicPem)).valid).toBe(false);
  });

  it("공개키로 서명하려 하면 이유를 알려 준다", async () => {
    const { publicPem } = await generateKeyPair("RS256");
    await expect(signJwt({ payload: PAYLOAD, key: publicPem, alg: "RS256" })).rejects.toThrow();
  });

  it("개인키로도 검증된다 (개인키만 들고 있을 때가 흔하다)", async () => {
    const { privatePem } = await generateKeyPair("RS256");
    const token = await signJwt({ payload: PAYLOAD, key: privatePem, alg: "RS256" });
    expect((await verifyJwt(token, privatePem)).valid).toBe(true);
  });

  it("ES256 서명은 64바이트(r‖s)다 — DER 이 아니다", async () => {
    const { privatePem } = await generateKeyPair("ES256");
    const sig = (await signJwt({ payload: PAYLOAD, key: privatePem, alg: "ES256" })).split(".")[2];
    const len = Math.floor((sig.length * 3) / 4);
    expect(len).toBe(64);
  });

  it("알고리즘과 키 종류가 안 맞으면 이유를 알려 준다", async () => {
    const { privatePem } = await generateKeyPair("ES256");
    await expect(signJwt({ payload: PAYLOAD, key: privatePem, alg: "RS256" })).rejects.toThrow();
  });

  it("HS 알고리즘에 PEM 을 주면 이유를 알려 준다", async () => {
    const { privatePem } = await generateKeyPair("RS256");
    await expect(signJwt({ payload: PAYLOAD, key: privatePem, alg: "HS256" })).rejects.toThrow();
  });
});

describe("checkClaims — 서명이 맞아도 봐야 할 것들", () => {
  const now = 1_700_000_000;

  it("만료를 잡는다", () => {
    const r = checkClaims({ exp: now - 1 }, { now });
    expect(r.expired).toBe(true);
    expect(r.problems.join(" ")).toMatch(/만료/);
  });

  it("아직 유효하지 않은 것을 잡는다 (nbf)", () => {
    // 시계 오차 60초는 봐 준다 — 그보다 확실히 미래인 값을 넣는다
    const r = checkClaims({ nbf: now + 600 }, { now });
    expect(r.notYet).toBe(true);
  });

  it("시계 오차(60초) 안쪽의 nbf 는 봐 준다", () => {
    expect(checkClaims({ nbf: now + 30 }, { now }).notYet).toBe(false);
  });

  it("미래에 발급된 토큰을 잡는다 (iat)", () => {
    expect(checkClaims({ iat: now + 600 }, { now }).problems.length).toBeGreaterThan(0);
  });

  it("문제가 없으면 problems 가 비어 있다", () => {
    expect(checkClaims({ exp: now + 60, nbf: now - 60, iat: now - 60 }, { now }).problems).toEqual([]);
  });

  it("시각 클레임이 없으면 아무 말도 하지 않는다 (표준이 필수로 두지 않는다)", () => {
    expect(checkClaims({ sub: "a" }, { now }).problems).toEqual([]);
  });

  it("시각이 숫자가 아니면 잘못됐다고 한다", () => {
    expect(checkClaims({ exp: "곧" }, { now }).problems.length).toBeGreaterThan(0);
  });
});

describe("verifyJwt — 서명과 시각을 함께 본다", () => {
  it("서명이 맞아도 만료됐으면 알려 준다", async () => {
    const { privatePem, publicPem } = await generateKeyPair("ES256");
    const token = await signJwt({ payload: { exp: 1 }, key: privatePem, alg: "ES256" });
    const r = await verifyJwt(token, publicPem);
    expect(r.valid).toBe(true);          // 서명 자체는 맞다
    expect(r.claims.expired).toBe(true); // 그러나 쓰면 안 된다
  });
});
