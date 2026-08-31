// 바이트 크기 변환 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { parseSize, formatBytes, convertSize } from "../bytes.js";

describe("parseSize", () => {
  it("단위 없는 숫자는 바이트로 본다", () => {
    expect(parseSize("1024").bytes).toBe(1024);
  });

  it("2진 접두사(KiB)는 1024 배수다", () => {
    expect(parseSize("1 KiB").bytes).toBe(1024);
    expect(parseSize("1MiB").bytes).toBe(1048576);
    expect(parseSize("1 GiB").bytes).toBe(1073741824);
  });

  it("10진 접두사(KB)는 1000 배수다", () => {
    expect(parseSize("1 KB").bytes).toBe(1000);
    expect(parseSize("1MB").bytes).toBe(1000000);
  });

  it("소수를 허용한다", () => {
    expect(parseSize("1.5 GiB").bytes).toBe(1610612736);
  });

  it("대소문자를 가리지 않는다", () => {
    expect(parseSize("1 kib").bytes).toBe(1024);
    expect(parseSize("2 Gb").bytes).toBe(2000000000);
  });

  it("해석 불가는 실패", () => {
    expect(parseSize("abc").ok).toBe(false);
    expect(parseSize("").ok).toBe(false);
  });
});

describe("formatBytes", () => {
  it("2진 단위로 사람이 읽게 만든다", () => {
    expect(formatBytes(1024, "binary")).toBe("1 KiB");
    expect(formatBytes(1536, "binary")).toBe("1.5 KiB");
    expect(formatBytes(0, "binary")).toBe("0 B");
  });

  it("10진 단위로도 만든다", () => {
    expect(formatBytes(1000, "decimal")).toBe("1 KB");
    expect(formatBytes(1500000, "decimal")).toBe("1.5 MB");
  });

  it("1024 바이트 미만은 B 로 둔다", () => {
    expect(formatBytes(512, "binary")).toBe("512 B");
  });
});

describe("convertSize", () => {
  it("모든 단위로 동시에 환산한다", () => {
    const r = convertSize(1073741824);
    expect(r.binary.GiB).toBe(1);
    expect(r.decimal.GB).toBeCloseTo(1.073741824, 6);
    expect(r.bytes).toBe(1073741824);
    expect(r.bits).toBe(8589934592);
  });
});
