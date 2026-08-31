// 진법 변환·비트 연산 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { parseNumber, toBase, convertAllBases, bitwise, toBitString, BIT_WIDTHS } from "../numberBase.js";

describe("parseNumber", () => {
  it("접두사로 진법을 자동 판별한다", () => {
    expect(parseNumber("0xff").value).toBe(255n);
    expect(parseNumber("0b1010").value).toBe(10n);
    expect(parseNumber("0o17").value).toBe(15n);
    expect(parseNumber("42").value).toBe(42n);
  });

  it("진법을 명시하면 그대로 쓴다", () => {
    expect(parseNumber("ff", 16).value).toBe(255n);
    expect(parseNumber("z", 36).value).toBe(35n);
  });

  it("구분자(_ , 공백)를 무시한다", () => {
    expect(parseNumber("1_000_000").value).toBe(1000000n);
    expect(parseNumber("ff ff", 16).value).toBe(65535n);
  });

  it("음수를 다룬다", () => {
    expect(parseNumber("-255").value).toBe(-255n);
  });

  it("64비트를 넘는 큰 수도 다룬다", () => {
    expect(parseNumber("0xFFFFFFFFFFFFFFFFF").value).toBe(295147905179352825855n);
  });

  it("잘못된 자리는 실패한다", () => {
    expect(parseNumber("12", 2).ok).toBe(false);
    expect(parseNumber("xyz").ok).toBe(false);
    expect(parseNumber("").ok).toBe(false);
  });
});

describe("toBase / convertAllBases", () => {
  it("진법별로 변환한다", () => {
    expect(toBase(255n, 2)).toBe("11111111");
    expect(toBase(255n, 8)).toBe("377");
    expect(toBase(255n, 16)).toBe("ff");
    expect(toBase(-10n, 16)).toBe("-a");
  });

  it("주요 진법을 한 번에 만든다", () => {
    const all = convertAllBases(255n);
    expect(all.bin).toBe("11111111");
    expect(all.oct).toBe("377");
    expect(all.dec).toBe("255");
    expect(all.hex).toBe("ff");
  });
});

describe("toBitString", () => {
  it("비트폭에 맞춰 0 패딩하고 4비트씩 끊는다", () => {
    expect(toBitString(5n, 8)).toBe("0000 0101");
    expect(toBitString(255n, 16)).toBe("0000 0000 1111 1111");
  });

  it("음수는 2의 보수로 표현한다", () => {
    expect(toBitString(-1n, 8)).toBe("1111 1111");
    expect(toBitString(-2n, 8)).toBe("1111 1110");
  });

  it("지원 비트폭 목록이 있다", () => {
    expect(BIT_WIDTHS).toEqual([8, 16, 32, 64]);
  });
});

describe("bitwise", () => {
  it("기본 연산을 수행한다", () => {
    expect(bitwise("and", 0b1100n, 0b1010n, 8)).toBe(0b1000n);
    expect(bitwise("or", 0b1100n, 0b1010n, 8)).toBe(0b1110n);
    expect(bitwise("xor", 0b1100n, 0b1010n, 8)).toBe(0b0110n);
  });

  it("NOT 은 비트폭으로 마스킹한다", () => {
    expect(bitwise("not", 0n, 0n, 8)).toBe(255n);
    expect(bitwise("not", 0b1111n, 0n, 8)).toBe(0b11110000n);
  });

  it("시프트를 수행한다", () => {
    expect(bitwise("shl", 1n, 4n, 8)).toBe(16n);
    expect(bitwise("shr", 16n, 4n, 8)).toBe(1n);
  });

  it("시프트가 비트폭을 넘으면 잘린다", () => {
    expect(bitwise("shl", 1n, 8n, 8)).toBe(0n);
  });
});
