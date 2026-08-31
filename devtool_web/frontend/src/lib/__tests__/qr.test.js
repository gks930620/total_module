// QR 코드 생성 계약 테스트 — 구현 전 선작성(Red).
// 스캐너 없이도 정확성을 검증하기 위해:
//  ① GF(256) 산술 항등식  ② RS 부호어의 신드롬이 전부 0 인지(수학적 정당성)
//  ③ 매트릭스 구조(파인더·타이밍·다크 모듈·크기) 검증
import { describe, it, expect } from "vitest";
import { generateQr, QR_ERROR_LEVELS, _internals } from "../qr.js";

const { gfMul, gfExp, gfLog, rsGenerator, rsEncode, buildDataCodewords, capacityOf } = _internals;

describe("GF(256) 산술", () => {
  it("1을 곱하면 그대로", () => {
    for (const v of [0, 1, 2, 87, 255]) expect(gfMul(v, 1)).toBe(v);
  });

  it("0을 곱하면 0", () => {
    expect(gfMul(123, 0)).toBe(0);
  });

  it("log/exp 가 서로 역함수다", () => {
    for (let i = 1; i < 256; i++) expect(gfExp[gfLog[i]]).toBe(i);
  });

  it("교환법칙이 성립한다", () => {
    expect(gfMul(37, 91)).toBe(gfMul(91, 37));
  });
});

describe("리드-솔로몬 부호", () => {
  it("생성 다항식의 차수가 EC 길이와 같다", () => {
    for (const n of [7, 10, 16, 18, 24, 26]) {
      expect(rsGenerator(n)).toHaveLength(n + 1);
    }
  });

  it("부호어의 신드롬이 전부 0이다 (RS 부호의 정의)", () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    const ec = rsEncode(data, 10);
    expect(ec).toHaveLength(10);

    const codeword = [...data, ...ec];
    for (let i = 0; i < 10; i++) {
      // S_i = C(α^i) — 유효한 RS 부호어라면 0이어야 한다
      let syndrome = 0;
      for (const c of codeword) {
        syndrome = gfMul(syndrome, gfExp[i]) ^ c;
      }
      expect(syndrome).toBe(0);
    }
  });
});

describe("데이터 코드워드 생성", () => {
  it("바이트 모드 헤더(0100)와 길이를 넣는다", () => {
    const cw = buildDataCodewords("A", 1);
    // 0100 0000 0001 0100 0001 ... → 첫 바이트 0x40, 둘째 0x14
    expect(cw[0]).toBe(0x40);
    expect(cw[1]).toBe(0x14);
  });

  it("용량만큼 패딩(0xEC, 0x11 교대)을 채운다", () => {
    const cap = capacityOf(1, "M");
    const cw = buildDataCodewords("A", 1, "M");
    expect(cw).toHaveLength(cap.dataCodewords);
    // "A" → 모드(0100) + 길이(1) + 'A' + 종단자 = 3바이트, 이후는 패딩
    expect(cw[3]).toBe(0xec);
    expect(cw[4]).toBe(0x11);
    expect(cw[5]).toBe(0xec);
  });
});

describe("generateQr", () => {
  it("짧은 문자열은 버전 1(21×21)이다", () => {
    const qr = generateQr("HI");
    expect(qr.ok).toBe(true);
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
    expect(qr.matrix).toHaveLength(21);
    expect(qr.matrix[0]).toHaveLength(21);
  });

  it("길이에 따라 버전이 올라간다", () => {
    expect(generateQr("https://example.com/some/longer/path?with=query").version).toBeGreaterThan(1);
  });

  it("세 모서리에 파인더 패턴(7×7)이 있다", () => {
    const { matrix, size } = generateQr("TEST");
    const finderOk = (r0, c0) => {
      // 바깥 테두리는 검정, 안쪽 링은 흰색, 가운데 3×3은 검정
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3));
          const expected = ring === 2 ? 0 : 1;
          if (matrix[r0 + i][c0 + j] !== expected) return false;
        }
      }
      return true;
    };
    expect(finderOk(0, 0)).toBe(true);
    expect(finderOk(0, size - 7)).toBe(true);
    expect(finderOk(size - 7, 0)).toBe(true);
  });

  it("타이밍 패턴이 교대로 채워진다", () => {
    const { matrix, size } = generateQr("TEST");
    for (let i = 8; i < size - 8; i++) {
      expect(matrix[6][i]).toBe(i % 2 === 0 ? 1 : 0);
      expect(matrix[i][6]).toBe(i % 2 === 0 ? 1 : 0);
    }
  });

  it("다크 모듈이 항상 켜져 있다", () => {
    const qr = generateQr("TEST");
    expect(qr.matrix[4 * qr.version + 9][8]).toBe(1);
  });

  it("한글(UTF-8 멀티바이트)을 담는다", () => {
    const qr = generateQr("한글 테스트");
    expect(qr.ok).toBe(true);
    expect(qr.byteLength).toBe(16); // 한글 3바이트×5 + 공백 1
  });

  it("용량을 넘으면 실패를 알린다", () => {
    const qr = generateQr("x".repeat(2000));
    expect(qr.ok).toBe(false);
    expect(qr.error).toContain("너무 깁니다");
  });

  it("빈 문자열은 실패한다", () => {
    expect(generateQr("").ok).toBe(false);
  });

  it("오류정정 레벨을 고를 수 있다", () => {
    expect(QR_ERROR_LEVELS.map((l) => l.key)).toEqual(["L", "M", "Q", "H"]);
    const l = generateQr("TEST", { level: "L" });
    const h = generateQr("TEST", { level: "H" });
    expect(l.ok && h.ok).toBe(true);
  });
});
