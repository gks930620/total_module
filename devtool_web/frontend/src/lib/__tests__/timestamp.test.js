// 타임스탬프 변환 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import {
  detectUnit,
  parseAnyToMs,
  formatIso,
  formatKst,
  formatUtc,
  toRelativeKo,
  breakdown,
} from "../timestamp.js";

describe("detectUnit", () => {
  it("10자리는 초, 13자리는 밀리초로 판별한다", () => {
    expect(detectUnit("1735689600")).toBe("s");
    expect(detectUnit("1735689600000")).toBe("ms");
  });

  it("16자리는 마이크로초, 19자리는 나노초로 판별한다", () => {
    expect(detectUnit("1735689600000000")).toBe("us");
    expect(detectUnit("1735689600000000000")).toBe("ns");
  });

  it("숫자가 아니면 null", () => {
    expect(detectUnit("2026-01-01")).toBe(null);
    expect(detectUnit("")).toBe(null);
  });
});

describe("parseAnyToMs", () => {
  it("epoch 초를 밀리초로 변환한다", () => {
    expect(parseAnyToMs("1735689600")).toBe(1735689600000);
  });

  it("epoch 밀리초는 그대로 둔다", () => {
    expect(parseAnyToMs("1735689600000")).toBe(1735689600000);
  });

  it("ISO-8601 문자열을 파싱한다", () => {
    expect(parseAnyToMs("2025-01-01T00:00:00Z")).toBe(1735689600000);
  });

  it("KST 오프셋이 붙은 ISO도 파싱한다", () => {
    expect(parseAnyToMs("2025-01-01T09:00:00+09:00")).toBe(1735689600000);
  });

  it("해석 불가면 null", () => {
    expect(parseAnyToMs("헬로")).toBe(null);
    expect(parseAnyToMs("")).toBe(null);
  });
});

describe("포맷", () => {
  const ms = 1735689600000; // 2025-01-01T00:00:00Z = 2025-01-01 09:00:00 KST

  it("ISO(UTC)로 포맷한다", () => {
    expect(formatIso(ms)).toBe("2025-01-01T00:00:00.000Z");
  });

  it("KST로 포맷한다(+09:00 고정)", () => {
    expect(formatKst(ms)).toBe("2025-01-01 09:00:00 (KST)");
  });

  it("UTC로 포맷한다", () => {
    expect(formatUtc(ms)).toBe("2025-01-01 00:00:00 (UTC)");
  });
});

describe("breakdown", () => {
  it("KST 기준 연·월·일·요일을 분해한다", () => {
    const b = breakdown(1735689600000);
    expect(b.kstYear).toBe(2025);
    expect(b.kstMonth).toBe(1);
    expect(b.kstDay).toBe(1);
    expect(b.kstWeekday).toBe("수");
  });
});

describe("toRelativeKo", () => {
  const now = 1735689600000;

  it("과거는 '전', 미래는 '후'로 표기한다", () => {
    expect(toRelativeKo(now - 60 * 1000, now)).toBe("1분 전");
    expect(toRelativeKo(now + 2 * 60 * 60 * 1000, now)).toBe("2시간 후");
  });

  it("1분 미만은 방금으로 표기한다", () => {
    expect(toRelativeKo(now - 5000, now)).toBe("방금");
  });

  it("일·개월·년 단위로 올라간다", () => {
    expect(toRelativeKo(now - 3 * 86400000, now)).toBe("3일 전");
    expect(toRelativeKo(now - 400 * 86400000, now)).toBe("1년 전");
  });
});
