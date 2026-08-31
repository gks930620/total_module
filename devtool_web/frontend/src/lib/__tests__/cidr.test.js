// IP/CIDR 계산기 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { parseCidr, ipToInt, intToIp, containsIp, splitSubnets } from "../cidr.js";

describe("ipToInt / intToIp", () => {
  it("IPv4 를 32비트 정수로 바꾼다", () => {
    expect(ipToInt("0.0.0.0")).toBe(0);
    expect(ipToInt("255.255.255.255")).toBe(4294967295);
    expect(ipToInt("192.168.0.1")).toBe(3232235521);
  });

  it("되돌린다", () => {
    expect(intToIp(3232235521)).toBe("192.168.0.1");
  });

  it("잘못된 IP 는 null", () => {
    expect(ipToInt("256.0.0.1")).toBe(null);
    expect(ipToInt("1.2.3")).toBe(null);
    expect(ipToInt("헬로")).toBe(null);
  });
});

describe("parseCidr", () => {
  it("/24 를 계산한다", () => {
    const r = parseCidr("192.168.0.0/24");
    expect(r.ok).toBe(true);
    expect(r.network).toBe("192.168.0.0");
    expect(r.broadcast).toBe("192.168.0.255");
    expect(r.netmask).toBe("255.255.255.0");
    expect(r.wildcard).toBe("0.0.0.255");
    expect(r.firstHost).toBe("192.168.0.1");
    expect(r.lastHost).toBe("192.168.0.254");
    expect(r.totalAddresses).toBe(256);
    expect(r.usableHosts).toBe(254);
  });

  it("호스트 주소를 줘도 네트워크를 찾아낸다", () => {
    expect(parseCidr("192.168.0.77/24").network).toBe("192.168.0.0");
  });

  it("/31 · /32 는 호스트 계산이 특수하다", () => {
    expect(parseCidr("10.0.0.1/32").usableHosts).toBe(1);
    expect(parseCidr("10.0.0.0/31").usableHosts).toBe(2);
  });

  it("/16 대역", () => {
    const r = parseCidr("172.16.0.0/16");
    expect(r.totalAddresses).toBe(65536);
    expect(r.netmask).toBe("255.255.0.0");
  });

  it("사설 대역 여부를 알려준다", () => {
    expect(parseCidr("192.168.0.0/24").isPrivate).toBe(true);
    expect(parseCidr("10.0.0.0/8").isPrivate).toBe(true);
    expect(parseCidr("8.8.8.8/32").isPrivate).toBe(false);
  });

  it("넷마스크 표기(192.168.0.0/255.255.255.0)도 받는다", () => {
    expect(parseCidr("192.168.0.0/255.255.255.0").prefix).toBe(24);
  });

  it("잘못된 입력은 실패", () => {
    expect(parseCidr("192.168.0.0/33").ok).toBe(false);
    expect(parseCidr("abc").ok).toBe(false);
  });
});

describe("containsIp", () => {
  it("대역 포함 여부를 판정한다", () => {
    expect(containsIp("192.168.0.0/24", "192.168.0.55")).toBe(true);
    expect(containsIp("192.168.0.0/24", "192.168.1.55")).toBe(false);
  });
});

describe("splitSubnets", () => {
  it("더 작은 프리픽스로 분할한다", () => {
    const subs = splitSubnets("192.168.0.0/24", 26);
    expect(subs).toHaveLength(4);
    expect(subs[0].network).toBe("192.168.0.0");
    expect(subs[3].network).toBe("192.168.0.192");
  });

  it("분할 개수가 많으면 상한까지만 준다", () => {
    expect(splitSubnets("10.0.0.0/8", 24).length).toBeLessThanOrEqual(256);
  });
});
