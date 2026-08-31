// UUID/ULID 생성기 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { uuidV4, uuidV7, ulid, nilUuid, inspectUuid, generateMany } from "../uuid.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("uuidV4", () => {
  it("표준 형식이다", () => {
    expect(uuidV4()).toMatch(UUID_RE);
  });

  it("버전 4 · variant 10xx 비트를 세팅한다", () => {
    const u = uuidV4();
    expect(u[14]).toBe("4");
    expect("89ab").toContain(u[19]);
  });

  it("호출마다 다르다", () => {
    const set = new Set(Array.from({ length: 200 }, () => uuidV4()));
    expect(set.size).toBe(200);
  });
});

describe("uuidV7", () => {
  it("표준 형식이며 버전 7이다", () => {
    const u = uuidV7();
    expect(u).toMatch(UUID_RE);
    expect(u[14]).toBe("7");
    expect("89ab").toContain(u[19]);
  });

  it("앞 48비트가 밀리초 타임스탬프라 시간순 정렬이 된다", () => {
    const a = uuidV7(1000);
    const b = uuidV7(2000);
    expect(a < b).toBe(true);
    // 48비트 = 앞 8자리 + 하이픈 + 4자리. 1000 = 0x3e8, 2000 = 0x7d0
    expect(a.slice(0, 13)).toBe("00000000-03e8");
    expect(b.slice(0, 13)).toBe("00000000-07d0");
  });
});

describe("ulid", () => {
  it("26자 Crockford Base32 이다", () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("시간순 사전식 정렬이 된다", () => {
    const a = ulid(1000);
    const b = ulid(2000);
    expect(a < b).toBe(true);
  });
});

describe("nilUuid", () => {
  it("전부 0이다", () => {
    expect(nilUuid()).toBe("00000000-0000-0000-0000-000000000000");
  });
});

describe("inspectUuid", () => {
  it("버전과 variant 를 읽어낸다", () => {
    const info = inspectUuid("018f3a5c-1b2d-7c3e-8f01-1234567890ab");
    expect(info.ok).toBe(true);
    expect(info.version).toBe(7);
    expect(info.variant).toBe("RFC 4122");
  });

  it("v7 은 내장 타임스탬프를 복원한다", () => {
    const u = uuidV7(1735689600000);
    expect(inspectUuid(u).timestampMs).toBe(1735689600000);
  });

  it("NIL 을 알아본다", () => {
    expect(inspectUuid("00000000-0000-0000-0000-000000000000").isNil).toBe(true);
  });

  it("형식이 틀리면 실패한다", () => {
    expect(inspectUuid("not-a-uuid").ok).toBe(false);
  });
});

describe("generateMany", () => {
  it("요청한 개수만큼 만든다", () => {
    expect(generateMany("v4", 5)).toHaveLength(5);
    expect(generateMany("ulid", 3)).toHaveLength(3);
  });
});

describe("uuidV7 — 한 번에 뽑아도 시간순이다", () => {
  it("같은 밀리초 안에서 뽑은 것도 정렬돼 있다", () => {
    // 도구는 "개수" 를 받아 한 번에 만든다. 그 100개가 대부분 같은 ms 에 들어가는데,
    // 그 안이 무작위면 "시간순 UUID" 라는 말이 목록에서 바로 깨진다.
    const list = Array.from({ length: 200 }, () => uuidV7());
    expect(list).toEqual([...list].sort());
  });

  it("generateMany 로 뽑아도 정렬돼 있다", () => {
    const list = generateMany("v7", 100);
    expect(list).toEqual([...list].sort());
  });

  it("중복이 없다", () => {
    const list = Array.from({ length: 5000 }, () => uuidV7());
    expect(new Set(list).size).toBe(5000);
  });

  it("여전히 버전 7 · variant 10xx 다", () => {
    for (const u of Array.from({ length: 50 }, () => uuidV7())) {
      expect(u[14]).toBe("7");
      expect("89ab").toContain(u[19]);
    }
  });
});
