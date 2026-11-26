// 명함 화면들이 같이 쓰는 조각 — 아바타, 연락처 행, QR.
import { useMemo } from "react";
import Icon from "./Icon.jsx";
import { shareQrSvg } from "../lib/shareLink.js";
import { useI18n } from "../lib/I18nProvider.jsx";

/** 이미지가 있으면 썸네일, 없으면 이름 첫 글자. */
export function CardAvatar({ card, size = "md" }) {
  const name = card.full_name || "";
  if (card.business_card_image_url) {
    return <img className={`bq-thumb bq-thumb--${size}`} src={card.business_card_image_url} alt="" loading="lazy" />;
  }
  return (
    <span className={`k-avatar bq-avatar--${size}`} aria-hidden="true">
      {/* 한글·한자는 첫 글자 하나, 로마자는 이니셜 둘 */}
      {initials(name)}
    </span>
  );
}

function initials(name) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/);
  if (/^[A-Za-z]/.test(trimmed) && words.length > 1) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return [...trimmed][0].toUpperCase();
}

/**
 * 연락처 한 줄. href 가 있으면 누를 수 있는 행, 없으면 글자만.
 * href 는 반드시 contactLinks.js 를 거쳐 만든 값이어야 한다(javascript: 차단).
 */
export function InfoRow({ icon, label, value, href, external = false }) {
  if (!value) return null;
  // 킷의 .k-item__title/__sub 는 블록 요소에 쓰는 전제다 — span 으로 두면 라벨과 값이 한 줄로 붙는다.
  const body = (
    <>
      <div className="k-item__icon bq-item-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </div>
      <div className="k-item__main">
        <div className="k-item__sub">{label}</div>
        <div className="k-item__title bq-break bq-preline">{value}</div>
      </div>
      {href && (
        <span className="k-item__chevron" aria-hidden="true">
          <Icon name="chevronRight" size={18} />
        </span>
      )}
    </>
  );
  if (!href) return <div className="k-item">{body}</div>;
  return (
    <a
      className="k-item"
      href={href}
      // 남이 입력한 외부 주소 — 새 탭으로 열고, 열린 페이지가 우리 창을 조작하지 못하게 끊는다.
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      {body}
    </a>
  );
}

/** 공유 링크 QR. 흰 바탕·검은 모듈 고정(다크 모드에서도 카메라가 읽게). */
export function QrCode({ url, downloadName }) {
  const { t } = useI18n();
  const qr = useMemo(() => shareQrSvg(url), [url]);

  if (!qr.ok) {
    return <div className="k-alert k-alert--warn">{t("qrCreateFailed")}</div>;
  }
  // <img src="data:..."> 로 그린다 — dangerouslySetInnerHTML 없이, CSP img-src data: 로만 열려 있다.
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`;
  return (
    <div className="k-stack bq-qr-block">
      <img className="bq-qr" src={src} alt={t("qrTitle")} width="240" height="240" />
      {downloadName && (
        <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => downloadAsPng(src, downloadName)}>
          <Icon name="download" size={18} />
          <span>{t("downloadQr")}</span>
        </button>
      )}
    </div>
  );
}

/**
 * QR 을 PNG 로 저장한다. SVG 는 카카오톡 등 메신저가 이미지로 받아 주지 않아서,
 * 누르는 순간 캔버스로 옮겨 PNG 로 바꾼다. 인쇄용으로도 쓰이니 넉넉한 크기(1024px)로 만든다.
 */
const PNG_SIZE = 1024;

function downloadAsPng(svgDataUrl, fileName) {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = PNG_SIZE;
    canvas.height = PNG_SIZE;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false; // QR 모듈 경계가 흐려지면 인식률이 떨어진다
    context.drawImage(image, 0, 0, PNG_SIZE, PNG_SIZE);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.png`;
      link.click();
      // 다운로드가 시작된 뒤에 놓아 준다 — 바로 놓으면 일부 브라우저에서 빈 파일이 된다.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };
  image.src = svgDataUrl;
}
