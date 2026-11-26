// 명함 공유 링크와 그 QR. 설계 웹앱_전환_설계.md §4.
//
// QR 에는 vCard 전체가 아니라 **공개 명함 링크**만 담는다.
//  - 짧아서 저해상도 카메라로도 잘 찍힌다(vCard 를 통째로 담으면 수백 바이트라 QR 이 빽빽해진다)
//  - 링크는 영구라 캡처해 둔 QR 도 계속 쓸 수 있다(앱의 5분 만료 링크와 다른 점)
//  - 명함을 고치면 QR 을 다시 만들 필요 없이 최신 내용이 보인다
import { generateQr, toSvg } from "./qr.js";

export function cardShareUrl(origin, cardId) {
  return `${String(origin).replace(/\/+$/, "")}/c/${encodeURIComponent(cardId)}`;
}

/**
 * 오류정정 M 을 먼저 시도하고(일부가 가려져도 찍힌다), 안 들어가면 L 로 낮춘다.
 * 지금 운영 도메인 + UUID(약 86바이트)는 M 으로 들어간다.
 *
 * QR 은 **항상 흰 바탕·검은 모듈**이다. 다크 모드 색을 따라가면 반전된 QR 이 되는데,
 * 그걸 못 읽는 카메라가 많다.
 */
export function shareQrSvg(url) {
  for (const level of ["M", "L"]) {
    const qr = generateQr(url, { level });
    if (qr.ok) {
      return {
        ok: true,
        level,
        svg: toSvg(qr, { moduleSize: 8, quietZone: 4, dark: "#000000", light: "#ffffff" }),
      };
    }
  }
  return { ok: false };
}
