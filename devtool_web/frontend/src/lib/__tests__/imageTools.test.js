// imageTools 중 **순수 계산부만** 테스트한다.
// Canvas·Image·FileReader 를 쓰는 부분은 브라우저 API 의존이라 단위 테스트 대상이 아니다
// (그래서 계산 로직을 일부러 분리해 뒀다).
import { describe, it, expect } from "vitest";
import { computeSize, mmToPx, readExif, IMAGE_FORMATS, PHOTO_SPECS, FAVICON_SIZES } from "../imageTools.js";
import { parsePageRange } from "../pdfTools.js";

describe("computeSize", () => {
  const src = { width: 4000, height: 3000 }; // 4:3

  it("가로 지정 — 비율을 유지한다", () => {
    const r = computeSize({ ...src, mode: "width", targetWidth: 800 });
    expect(r).toMatchObject({ width: 800, height: 600 });
  });

  it("세로 지정 — 비율을 유지한다", () => {
    expect(computeSize({ ...src, mode: "height", targetHeight: 600 })).toMatchObject({ width: 800, height: 600 });
  });

  it("퍼센트 축소", () => {
    expect(computeSize({ ...src, mode: "percent", percent: 25 })).toMatchObject({ width: 1000, height: 750 });
  });

  it("fit — 상자 안에 넣는다", () => {
    const r = computeSize({ ...src, mode: "fit", targetWidth: 1000, targetHeight: 1000 });
    expect(r.width).toBe(1000);
    expect(r.height).toBe(750);
  });

  it("fit 은 기본적으로 확대하지 않는다", () => {
    const r = computeSize({ width: 100, height: 100, mode: "fit", targetWidth: 500, targetHeight: 500 });
    expect(r).toMatchObject({ width: 100, height: 100 });
  });

  it("확대를 허용하면 커진다", () => {
    const r = computeSize({ width: 100, height: 100, mode: "fit", targetWidth: 500, targetHeight: 500, allowUpscale: true });
    expect(r.width).toBe(500);
    expect(r.upscaled).toBe(true);
  });

  it("exact — 비율을 무시하고 정확히", () => {
    expect(computeSize({ ...src, mode: "exact", targetWidth: 1200, targetHeight: 630 }))
      .toMatchObject({ width: 1200, height: 630 });
  });

  it("최소 1px 은 보장한다", () => {
    expect(computeSize({ width: 10, height: 10, mode: "percent", percent: 1 }).height).toBeGreaterThanOrEqual(1);
  });

  it("입력이 잘못되면 사유를 준다", () => {
    expect(computeSize({ width: 0, height: 0 }).ok).toBe(false);
    expect(computeSize({ ...src, mode: "width" }).ok).toBe(false);
    expect(computeSize({ ...src, mode: "exact", targetWidth: 100 }).ok).toBe(false);
  });
});

describe("mmToPx", () => {
  it("300dpi 기준 여권사진 35×45mm → 413×531px", () => {
    expect(mmToPx(35)).toBe(413);
    expect(mmToPx(45)).toBe(531);
  });
  it("dpi 를 바꿀 수 있다", () => {
    expect(mmToPx(25.4, 72)).toBe(72);
  });
});

describe("상수 목록", () => {
  it("이미지 형식에 확장자와 MIME 이 있다", () => {
    for (const f of IMAGE_FORMATS) {
      expect(f.key).toMatch(/^image\//);
      expect(f.ext).toBeTruthy();
    }
  });
  it("증명사진 규격이 mm 쌍을 가진다", () => {
    for (const s of PHOTO_SPECS) expect(s.mm).toHaveLength(2);
  });
  it("파비콘 크기가 오름차순", () => {
    expect([...FAVICON_SIZES].sort((a, b) => a - b)).toEqual(FAVICON_SIZES);
  });
});

describe("readExif", () => {
  it("JPEG 가 아니면 EXIF 없음으로 알려 준다", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    const r = readExif(png);
    expect(r.ok).toBe(true);
    expect(r.hasExif).toBe(false);
    expect(r.note).toContain("JPEG");
  });

  it("EXIF 가 없는 JPEG 는 hasExif=false", () => {
    // SOI + SOS 만 있는 최소 JPEG
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]);
    const r = readExif(jpg);
    expect(r.ok).toBe(true);
    expect(r.hasExif).toBe(false);
    expect(r.gps).toBe(null);
  });

  it("빈 입력은 실패", () => {
    expect(readExif(new Uint8Array([])).ok).toBe(false);
    expect(readExif(null).ok).toBe(false);
  });
});

describe("parsePageRange (pdfTools)", () => {
  it("단일 페이지·범위·열린 범위를 모두 해석한다", () => {
    expect(parsePageRange("1,3", 10)).toEqual([0, 2]);
    expect(parsePageRange("2-4", 10)).toEqual([1, 2, 3]);
    expect(parsePageRange("8-", 10)).toEqual([7, 8, 9]);
    expect(parsePageRange("-3", 10)).toEqual([0, 1, 2]);
  });

  it("중복을 제거한다", () => {
    expect(parsePageRange("1,1,1-2", 10)).toEqual([0, 1]);
  });

  it("범위를 벗어난 값은 버린다", () => {
    expect(parsePageRange("5-100", 6)).toEqual([4, 5]);
    expect(parsePageRange("0,99", 6)).toEqual([]);
  });

  it("빈 문자열·쓰레기 입력은 빈 배열", () => {
    expect(parsePageRange("", 10)).toEqual([]);
    expect(parsePageRange("abc", 10)).toEqual([]);
  });
});
