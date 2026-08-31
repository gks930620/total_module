// HMAC · 기대값 대조 계약 테스트 — 구현 전 선작성(Red).
//
// 기준값은 RFC 4231 시험 벡터다. 우리끼리 왕복되는 것으로는 남의 서버와 맞는지 알 수 없다.
import { describe, it, expect } from "vitest";
import { hmac, HMAC_ALGOS, hmacAll, compareHash, normalizeHash } from "../hash.js";

// RFC 4231 Test Case 1: key = 0x0b × 20, data = "Hi There"
const RFC_KEY = new Uint8Array(20).fill(0x0b);
const RFC_DATA = "Hi There";
const RFC = {
  "sha-1": "b617318655057264e28bc0b6fb378c8ef146be00",
  "sha-256": "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
  "sha-384": "afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6",
  "sha-512": "87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854",
};

describe("HMAC_ALGOS", () => {
  it("SHA 계열 네 가지를 제공한다 (MD5·CRC32 는 Web Crypto 에 없다)", () => {
    expect(HMAC_ALGOS.map((a) => a.key)).toEqual(["sha-1", "sha-256", "sha-384", "sha-512"]);
  });

  it("항목마다 화면에 쓸 이름이 있다", () => {
    for (const a of HMAC_ALGOS) expect(String(a.label || "").trim()).not.toBe("");
  });
});

describe("hmac — RFC 4231 시험 벡터와 값이 맞는다", () => {
  it.each(Object.keys(RFC))("%s", async (algo) => {
    expect(await hmac(algo, RFC_KEY, RFC_DATA)).toBe(RFC[algo]);
  });

  it("문자열 키도 받는다", async () => {
    expect(await hmac("sha-256", "key", "The quick brown fox jumps over the lazy dog"))
      .toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });

  it("키가 한 글자만 달라도 값이 완전히 달라진다", async () => {
    const a = await hmac("sha-256", "key1", "msg");
    const b = await hmac("sha-256", "key2", "msg");
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
  });

  it("한글 키·메시지도 된다", async () => {
    const v = await hmac("sha-256", "비밀키", "안녕하세요");
    expect(v).toMatch(/^[0-9a-f]{64}$/);
  });

  it("빈 키는 거절한다 — HMAC 의 뜻이 없어진다", async () => {
    await expect(hmac("sha-256", "", "msg")).rejects.toThrow();
  });

  it("모르는 알고리즘은 거절한다", async () => {
    await expect(hmac("md5", "k", "m")).rejects.toThrow();
  });

  it("파일 바이트(Uint8Array)도 받는다", async () => {
    const bytes = new TextEncoder().encode("Hi There");
    expect(await hmac("sha-256", RFC_KEY, bytes)).toBe(RFC["sha-256"]);
  });
});

describe("hmacAll — 네 가지를 한 번에", () => {
  it("전부 계산한다", async () => {
    const out = await hmacAll(RFC_KEY, RFC_DATA);
    for (const [k, v] of Object.entries(RFC)) expect(out[k], k).toBe(v);
  });
});

describe("normalizeHash — 붙여넣은 해시를 다듬는다", () => {
  it("대소문자와 공백을 없앤다", () => {
    expect(normalizeHash("  ABC123  ")).toBe("abc123");
  });

  it("구분자로 끊어 적은 것도 받아 준다 (sha256sum · 윈도 certutil 출력)", () => {
    expect(normalizeHash("ab cd ef")).toBe("abcdef");
    expect(normalizeHash("ab:cd:ef")).toBe("abcdef");
    expect(normalizeHash("ab-cd-ef")).toBe("abcdef");
  });

  it("파일명이 붙어 있으면 해시 부분만 뽑는다 (sha256sum 출력 형식)", () => {
    expect(normalizeHash("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  a.txt"))
      .toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("compareHash — 기대값과 맞는지 알려 준다", () => {
  const results = {
    md5: "900150983cd24fb0d6963f7d28e17f72",
    "sha-1": "a9993e364706816aba3e25717850c26c9cd0d89d",
    "sha-256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  };

  it("어느 알고리즘과 맞는지 짚어 준다", () => {
    const r = compareHash(results, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(r.matched).toBe("sha-256");
  });

  it("대문자로 붙여넣어도 찾는다", () => {
    expect(compareHash(results, "900150983CD24FB0D6963F7D28E17F72").matched).toBe("md5");
  });

  it("맞는 것이 없으면 matched 가 null 이다", () => {
    const r = compareHash(results, "0".repeat(64));
    expect(r.matched).toBeNull();
    expect(r.checked).toBe(true);
  });

  it("길이로 어떤 알고리즘을 기대했는지 알려 준다 — 틀렸을 때 원인을 좁혀 준다", () => {
    const r = compareHash(results, "0".repeat(64));
    expect(r.guessed).toBe("sha-256");
  });

  it("기대값이 비어 있으면 아무 판정도 하지 않는다", () => {
    expect(compareHash(results, "").checked).toBe(false);
    expect(compareHash(results, "   ").checked).toBe(false);
  });

  it("16진수가 아니면 알려 준다", () => {
    const r = compareHash(results, "이건 해시가 아니다");
    expect(r.checked).toBe(true);
    expect(r.invalid).toBe(true);
  });
});
