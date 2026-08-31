// 이름 기반 UUID(v3·v5) · v1 계약 테스트 — 구현 전 선작성(Red).
//
// 기준값은 RFC 4122 네임스페이스로 계산한 널리 알려진 값이다.
// 같은 이름에서 **언제 어디서나 같은 UUID** 가 나와야 쓸모가 있으므로 바깥 값에 고정한다.
import { describe, it, expect } from "vitest";
import { uuidV1, uuidV3, uuidV5, NAMESPACES, inspectUuid, UUID_KINDS, generateMany } from "../uuid.js";

const DNS = NAMESPACES.find((n) => n.key === "dns").uuid;
const URL_NS = NAMESPACES.find((n) => n.key === "url").uuid;

describe("NAMESPACES — RFC 4122 가 정한 네 가지", () => {
  it("DNS · URL · OID · X500 을 제공한다", () => {
    expect(NAMESPACES.map((n) => n.key)).toEqual(["dns", "url", "oid", "x500"]);
  });

  it("표준이 정한 UUID 값 그대로다", () => {
    expect(DNS).toBe("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
    expect(URL_NS).toBe("6ba7b811-9dad-11d1-80b4-00c04fd430c8");
  });
});

describe("uuidV5 — 같은 이름이면 언제나 같은 값", () => {
  it("널리 알려진 기준값과 맞는다", () => {
    expect(uuidV5(DNS, "example.com")).toBe("cfbff0d1-9375-5685-968c-48ce8b15ae17");
    expect(uuidV5(DNS, "www.example.com")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
    expect(uuidV5(URL_NS, "https://example.com")).toBe("4fd35a71-71ef-5a55-a9d9-aa75c889a6d0");
  });

  it("몇 번을 불러도 같은 값이다", () => {
    const a = uuidV5(DNS, "same-name");
    for (let i = 0; i < 10; i++) expect(uuidV5(DNS, "same-name")).toBe(a);
  });

  it("이름이 한 글자만 달라도 값이 완전히 달라진다", () => {
    expect(uuidV5(DNS, "a")).not.toBe(uuidV5(DNS, "b"));
  });

  it("네임스페이스가 다르면 값이 다르다", () => {
    expect(uuidV5(DNS, "x")).not.toBe(uuidV5(URL_NS, "x"));
  });

  it("한글 이름도 UTF-8 로 처리한다", () => {
    expect(uuidV5(DNS, "한글")).toBe("b9cf4fcb-01de-51c4-824d-72b70039bed6");
  });

  it("버전 5 · variant 10xx 를 지킨다", () => {
    const u = uuidV5(DNS, "x");
    expect(u[14]).toBe("5");
    expect("89ab").toContain(u[19]);
  });

  it("네임스페이스가 UUID 가 아니면 거절한다", () => {
    expect(() => uuidV5("네임스페이스아님", "x")).toThrow();
  });
});

describe("uuidV3 — MD5 를 쓰는 옛 방식", () => {
  it("기준값과 맞는다", () => {
    expect(uuidV3(DNS, "example.com")).toBe("9073926b-929f-31c2-abc9-fad77ae3e8eb");
  });

  it("버전 3 을 지킨다", () => {
    expect(uuidV3(DNS, "x")[14]).toBe("3");
  });

  it("v5 와 다른 값이다 (해시가 다르다)", () => {
    expect(uuidV3(DNS, "x")).not.toBe(uuidV5(DNS, "x"));
  });
});

describe("uuidV1 — 시각 기반(옛 방식)", () => {
  it("버전 1 · variant 10xx 를 지킨다", () => {
    const u = uuidV1();
    expect(u[14]).toBe("1");
    expect("89ab").toContain(u[19]);
  });

  it("중복이 없다", () => {
    const set = new Set(Array.from({ length: 3000 }, () => uuidV1()));
    expect(set.size).toBe(3000);
  });

  it("노드 ID 의 멀티캐스트 비트를 세운다 (MAC 주소가 아님을 표준대로 표시)", () => {
    // 브라우저는 MAC 을 알 수 없으므로 무작위 노드를 쓴다. RFC 9562 §5.1 이 요구하는 표시다.
    const first = parseInt(uuidV1().slice(24, 26), 16);
    expect(first & 0x01).toBe(1);
  });
});

describe("UUID_KINDS — 화면이 고를 수 있는 것", () => {
  it("v1 · v3 · v4 · v5 · v7 · ULID · NIL 을 제공한다", () => {
    expect(UUID_KINDS.map((k) => k.key)).toEqual(["v4", "v7", "v1", "v3", "v5", "ulid", "nil"]);
  });

  it("이름이 필요한 것에 표시가 있다", () => {
    const byKey = Object.fromEntries(UUID_KINDS.map((k) => [k.key, k]));
    expect(byKey.v3.needsName).toBe(true);
    expect(byKey.v5.needsName).toBe(true);
    expect(byKey.v4.needsName).toBeFalsy();
  });
});

describe("generateMany — 이름 기반도 개수만큼", () => {
  it("v5 는 같은 이름이면 전부 같은 값이다 (그게 요점이다)", () => {
    const list = generateMany("v5", 3, { namespace: DNS, name: "x" });
    expect(new Set(list).size).toBe(1);
  });

  it("이름이 없으면 이름 기반은 만들 수 없다고 알린다", () => {
    expect(() => generateMany("v5", 1, {})).toThrow();
  });

  it("v1 은 개수만큼 서로 다르다", () => {
    expect(new Set(generateMany("v1", 50)).size).toBe(50);
  });
});

describe("inspectUuid — 새 버전도 읽는다", () => {
  it("v5 를 알아본다", () => {
    const r = inspectUuid(uuidV5(DNS, "x"));
    expect(r.version).toBe(5);
  });

  it("v1 의 생성 시각을 읽어 준다", () => {
    const before = Date.now();
    const r = inspectUuid(uuidV1());
    // 60비트 시각이 세 조각으로 흩어져 있어 순서를 틀리기 쉽다 — 지금 시각과 맞는지로 잡는다
    expect(r.timestampMs).toBeGreaterThanOrEqual(before - 5000);
    expect(r.timestampMs).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it("v3 를 알아본다", () => {
    expect(inspectUuid(uuidV3(DNS, "x")).version).toBe(3);
  });
});
