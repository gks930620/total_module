// cron 표현식 해석기 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { explainCronToken, parseCron, describeCron, nextRuns } from "../cron.js";

describe("parseCron", () => {
  it("5필드 표준 cron 을 파싱한다", () => {
    const r = parseCron("30 2 * * 1-5");
    expect(r.ok).toBe(true);
    expect(r.fields.minute).toEqual([30]);
    expect(r.fields.hour).toEqual([2]);
    expect(r.fields.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it("6필드(초 포함) cron 을 파싱한다", () => {
    const r = parseCron("0 30 2 * * *");
    expect(r.ok).toBe(true);
    expect(r.hasSeconds).toBe(true);
    expect(r.fields.second).toEqual([0]);
  });

  it("스텝(*/15)을 전개한다", () => {
    expect(parseCron("*/15 * * * *").fields.minute).toEqual([0, 15, 30, 45]);
  });

  it("범위+스텝(10-20/5)을 전개한다", () => {
    expect(parseCron("10-20/5 * * * *").fields.minute).toEqual([10, 15, 20]);
  });

  it("콤마 목록을 전개한다", () => {
    expect(parseCron("0 9,18 * * *").fields.hour).toEqual([9, 18]);
  });

  it("요일 이름을 숫자로 바꾼다", () => {
    expect(parseCron("0 0 * * MON-FRI").fields.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it("일요일 7 을 0 으로 정규화한다", () => {
    expect(parseCron("0 0 * * 7").fields.dayOfWeek).toEqual([0]);
  });

  it("월 이름을 숫자로 바꾼다", () => {
    expect(parseCron("0 0 1 JAN,DEC *").fields.month).toEqual([1, 12]);
  });

  it("필드 개수가 틀리면 실패한다", () => {
    expect(parseCron("* * *").ok).toBe(false);
  });

  it("범위를 벗어나면 실패한다", () => {
    expect(parseCron("70 * * * *").ok).toBe(false);
    expect(parseCron("* 25 * * *").ok).toBe(false);
  });

  it("빈 문자열은 실패한다", () => {
    expect(parseCron("").ok).toBe(false);
  });
});

describe("describeCron", () => {
  it("매분 실행을 설명한다", () => {
    expect(describeCron("* * * * *")).toContain("매분");
  });

  it("특정 시각을 한국어로 설명한다", () => {
    const d = describeCron("30 2 * * *");
    expect(d).toContain("02:30");
    expect(d).toContain("매일");
  });

  it("요일 조건을 한국어로 설명한다", () => {
    expect(describeCron("0 9 * * 1-5")).toContain("월~금");
  });

  it("오류는 오류 메시지를 반환한다", () => {
    expect(describeCron("nope")).toContain("해석할 수 없습니다");
  });
});

describe("nextRuns", () => {
  // 기준: 2025-01-01 00:00:00 KST = 2024-12-31T15:00:00Z
  const base = Date.UTC(2024, 11, 31, 15, 0, 0);

  it("다음 실행 시각을 KST 기준으로 계산한다", () => {
    const runs = nextRuns("30 2 * * *", { from: base, count: 2 });
    expect(runs).toHaveLength(2);
    expect(runs[0].kst).toBe("2025-01-01 02:30:00");
    expect(runs[1].kst).toBe("2025-01-02 02:30:00");
  });

  it("요일 제한을 반영한다 (2025-01-01은 수요일)", () => {
    const runs = nextRuns("0 9 * * 6", { from: base, count: 1 });
    expect(runs[0].kst).toBe("2025-01-04 09:00:00"); // 첫 토요일
  });

  it("월/일 제한을 반영한다", () => {
    const runs = nextRuns("0 0 1 3 *", { from: base, count: 1 });
    expect(runs[0].kst).toBe("2025-03-01 00:00:00");
  });

  it("잘못된 표현식은 빈 배열", () => {
    expect(nextRuns("nope", { from: base, count: 3 })).toEqual([]);
  });
});

describe("explainCronToken — 필드에 쓴 문법을 한국어로 풀이한다", () => {
  const ex = explainCronToken;

  it("* 는 필드마다 다르게 읽는다", () => {
    expect(ex("*", "minute")).toBe("매분");
    expect(ex("*", "hour")).toBe("매시");
    expect(ex("*", "dayOfMonth")).toBe("날짜 상관없음");
    expect(ex("*", "dayOfWeek")).toBe("요일 상관없음");
  });

  it("? 는 지정하지 않겠다는 뜻이다", () => {
    expect(ex("?", "dayOfWeek")).toBe("지정 안 함");
  });

  it("*/n 은 n 마다", () => {
    expect(ex("*/30", "minute")).toBe("30분마다");
    expect(ex("*/2", "hour")).toBe("2시간마다");
  });

  it("a-b 는 범위", () => {
    expect(ex("9-18", "hour")).toBe("9시~18시");
    expect(ex("1-5", "dayOfWeek")).toBe("월요일~금요일");
  });

  it("a-b/n 은 범위 안에서 n 간격", () => {
    expect(ex("10-20/5", "minute")).toBe("10분~20분 사이 5분 간격");
  });

  it("쉼표는 목록으로 읽는다", () => {
    expect(ex("0,30", "minute")).toBe("0분, 30분");
    expect(ex("1,3,5", "dayOfWeek")).toBe("월요일, 수요일, 금요일");
  });

  it("월과 요일 이름도 읽는다", () => {
    expect(ex("JAN", "month")).toBe("1월");
    expect(ex("MON-FRI", "dayOfWeek")).toBe("월요일~금요일");
  });

  it("숫자 하나는 그 값 하나다", () => {
    expect(ex("0", "minute")).toBe("0분");
    expect(ex("3", "month")).toBe("3월");
  });
});
