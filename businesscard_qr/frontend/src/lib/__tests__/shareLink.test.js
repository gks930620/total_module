// 공유 링크·QR 계약 — 설계 웹앱_전환_설계.md §4.
// QR 에는 vCard 전체가 아니라 **공개 명함 링크**만 담는다. 그래야 짧아서 어떤 폰 카메라로도 잘 찍힌다.
import { describe, it, expect } from "vitest";
import { cardShareUrl, shareQrSvg } from "../shareLink.js";

const UUID = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c";
// 지금 실제 운영 도메인 — 이 길이에서 반드시 QR 이 나와야 한다.
const RAILWAY_ORIGIN = "https://businesscardqr-production.up.railway.app";

describe("cardShareUrl", () => {
  it("공개 명함 경로 /c/{id} 를 만든다", () => {
    expect(cardShareUrl("https://card.example.com", UUID)).toBe(`https://card.example.com/c/${UUID}`);
  });

  it("origin 끝의 / 를 겹치지 않게 처리한다", () => {
    expect(cardShareUrl("https://card.example.com/", UUID)).toBe(`https://card.example.com/c/${UUID}`);
  });

  it("id 를 URL 인코딩한다 — 경로 조작 문자가 들어와도 경로를 벗어나지 않는다", () => {
    expect(cardShareUrl("https://a.com", "../x")).toBe("https://a.com/c/..%2Fx");
  });
});

describe("shareQrSvg", () => {
  it("운영 도메인 길이의 링크로 QR SVG 를 만든다", () => {
    const result = shareQrSvg(cardShareUrl(RAILWAY_ORIGIN, UUID));
    expect(result.ok).toBe(true);
    expect(result.svg).toMatch(/^<svg /);
  });

  it("가능하면 오류정정 M 을 쓴다 — 화면이 조금 가려지거나 흐려도 찍힌다", () => {
    const result = shareQrSvg(cardShareUrl(RAILWAY_ORIGIN, UUID));
    expect(result.level).toBe("M");
  });

  it("M 으로 안 들어가는 긴 도메인은 L 로 낮춰서라도 만든다", () => {
    // M 의 최대(버전 6 = 106바이트)는 넘고 L 의 최대(134바이트)는 안 넘는 길이
    const longOrigin = "https://" + "a".repeat(70) + ".com";
    const result = shareQrSvg(cardShareUrl(longOrigin, UUID));
    expect(result.ok).toBe(true);
    expect(result.level).toBe("L");
  });

  it("L 로도 안 들어가면 실패를 돌려준다 — 화면이 예외로 죽지 않는다", () => {
    const result = shareQrSvg("https://" + "a".repeat(200) + ".com");
    expect(result.ok).toBe(false);
  });

  it("다크 모드에서도 찍히도록 항상 흰 바탕·검은 모듈로 그린다", () => {
    // 카메라는 반전된(검은 바탕) QR 을 못 읽는 경우가 많다. 테마 색을 따라가면 안 된다.
    const { svg } = shareQrSvg(cardShareUrl(RAILWAY_ORIGIN, UUID));
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('fill="#000000"');
  });
});
