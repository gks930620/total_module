// IPv4 / CIDR 서브넷 계산기 — 전부 클라이언트(NFR-02).

const MAX_SPLIT = 256; // 분할 결과 상한(브라우저 보호)

/** "192.168.0.1" → 3232235521 (실패 시 null) */
export function ipToInt(ip) {
  const parts = String(ip ?? "").trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** 3232235521 → "192.168.0.1" */
export function intToIp(value) {
  const v = Number(value) >>> 0;
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join(".");
}

function prefixToMaskInt(prefix) {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

function maskIntToPrefix(mask) {
  // 연속된 1로만 이루어졌는지 확인
  const inverted = ~mask >>> 0;
  if (((inverted + 1) & inverted) !== 0) return null;
  let count = 0;
  let m = mask >>> 0;
  while (m & 0x80000000) {
    count++;
    m = (m << 1) >>> 0;
  }
  return count;
}

const PRIVATE_RANGES = [
  ["10.0.0.0", 8, "사설망 (RFC 1918)"],
  ["172.16.0.0", 12, "사설망 (RFC 1918)"],
  ["192.168.0.0", 16, "사설망 (RFC 1918)"],
  ["127.0.0.0", 8, "루프백"],
  ["169.254.0.0", 16, "링크 로컬 (APIPA)"],
  ["100.64.0.0", 10, "캐리어 그레이드 NAT"],
  ["224.0.0.0", 4, "멀티캐스트"],
];

function classifyIp(intIp) {
  for (const [base, prefix, label] of PRIVATE_RANGES) {
    const maskInt = prefixToMaskInt(prefix);
    if ((intIp & maskInt) >>> 0 === (ipToInt(base) & maskInt) >>> 0) {
      return label;
    }
  }
  return "공인 IP";
}

/** "192.168.0.0/24" 또는 "192.168.0.0/255.255.255.0" 파싱 */
export function parseCidr(input) {
  const s = String(input ?? "").trim();
  const slash = s.indexOf("/");
  const ipPart = slash < 0 ? s : s.slice(0, slash);
  const maskPart = slash < 0 ? "32" : s.slice(slash + 1);

  const ipInt = ipToInt(ipPart);
  if (ipInt === null) {
    return { ok: false, reason: "IPv4 주소 형식이 아닙니다. 예) 192.168.0.0/24" };
  }

  let prefix;
  if (/^\d{1,2}$/.test(maskPart)) {
    prefix = Number(maskPart);
    if (prefix > 32) return { ok: false, reason: "프리픽스는 0~32 여야 합니다." };
  } else {
    const maskInt = ipToInt(maskPart);
    if (maskInt === null) return { ok: false, reason: "넷마스크 형식이 아닙니다." };
    prefix = maskIntToPrefix(maskInt);
    if (prefix === null) return { ok: false, reason: "넷마스크가 연속된 1비트가 아닙니다." };
  }

  const maskInt = prefixToMaskInt(prefix);
  const network = (ipInt & maskInt) >>> 0;
  const broadcast = (network | (~maskInt >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);

  // /31 은 점대점 링크(RFC 3021)라 2개 다 쓰고, /32 는 단일 호스트
  let usableHosts;
  let firstHost;
  let lastHost;
  if (prefix === 32) {
    usableHosts = 1;
    firstHost = intToIp(network);
    lastHost = intToIp(network);
  } else if (prefix === 31) {
    usableHosts = 2;
    firstHost = intToIp(network);
    lastHost = intToIp(broadcast);
  } else {
    usableHosts = total - 2;
    firstHost = intToIp(network + 1);
    lastHost = intToIp(broadcast - 1);
  }

  const kind = classifyIp(network);
  return {
    ok: true,
    input: s,
    prefix,
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    netmask: intToIp(maskInt),
    wildcard: intToIp(~maskInt >>> 0),
    firstHost,
    lastHost,
    totalAddresses: total,
    usableHosts,
    networkInt: network,
    broadcastInt: broadcast,
    cidr: `${intToIp(network)}/${prefix}`,
    kind,
    isPrivate: kind !== "공인 IP" && kind !== "멀티캐스트",
  };
}

/** IP 가 대역에 속하는지 */
export function containsIp(cidr, ip) {
  const r = parseCidr(cidr);
  const target = ipToInt(ip);
  if (!r.ok || target === null) return false;
  return target >= r.networkInt && target <= r.broadcastInt;
}

/** 더 긴 프리픽스로 분할 */
export function splitSubnets(cidr, newPrefix) {
  const r = parseCidr(cidr);
  if (!r.ok || newPrefix <= r.prefix || newPrefix > 32) return [];
  const count = Math.min(2 ** (newPrefix - r.prefix), MAX_SPLIT);
  const step = 2 ** (32 - newPrefix);
  const out = [];
  for (let i = 0; i < count; i++) {
    const base = r.networkInt + i * step;
    out.push({
      network: intToIp(base),
      cidr: `${intToIp(base)}/${newPrefix}`,
      broadcast: intToIp(base + step - 1),
      usableHosts: newPrefix >= 31 ? (newPrefix === 32 ? 1 : 2) : step - 2,
    });
  }
  return out;
}
