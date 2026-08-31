// 해시 생성기 계약 테스트 — 구현 전 선작성(Red).
// 표준 테스트 벡터(RFC 1321 / FIPS 180-4)로 검증한다.
import { describe, it, expect } from "vitest";
import { md5, crc32, sha, hashAll, HASH_ALGOS } from "../hash.js";

describe("md5", () => {
  it("RFC 1321 테스트 벡터와 일치한다", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5("a")).toBe("0cc175b9c0f1b6a831c399e269772661");
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5("message digest")).toBe("f96b697d7cb7938d525a2f31aaf161d0");
    expect(md5("abcdefghijklmnopqrstuvwxyz")).toBe("c3fcd3d76192e4007dfb496cca67e13b");
  });

  it("64바이트 경계(패딩 블록 추가)를 넘겨도 맞는다", () => {
    expect(md5("12345678901234567890123456789012345678901234567890123456789012345678901234567890"))
      .toBe("57edf4a22be3c955ac49da2e2107b67a");
  });

  it("UTF-8 한글을 바이트로 해싱한다", () => {
    // "한글"의 UTF-8 바이트 EC 95 9C EA B8 80 에 대한 MD5
    expect(md5("한글")).toHaveLength(32);
    expect(md5("한글")).toBe(md5("한글"));
    expect(md5("한글")).not.toBe(md5("한굴"));
  });
});

describe("crc32", () => {
  it("표준 CRC-32 값과 일치한다", () => {
    expect(crc32("")).toBe("00000000");
    expect(crc32("a")).toBe("e8b7be43");
    expect(crc32("abc")).toBe("352441c2");
    expect(crc32("123456789")).toBe("cbf43926");
  });
});

describe("sha (WebCrypto)", () => {
  it("SHA-1 테스트 벡터", async () => {
    expect(await sha("SHA-1", "abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });

  it("SHA-256 테스트 벡터", async () => {
    expect(await sha("SHA-256", "abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(await sha("SHA-256", "")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("SHA-512 테스트 벡터", async () => {
    expect(await sha("SHA-512", "abc")).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
        "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
    );
  });
});

describe("hashAll", () => {
  it("지원 알고리즘 전체를 한 번에 계산한다", async () => {
    const out = await hashAll("abc");
    expect(Object.keys(out)).toEqual(HASH_ALGOS.map((a) => a.key));
    expect(out["md5"]).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(out["sha-256"]).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
