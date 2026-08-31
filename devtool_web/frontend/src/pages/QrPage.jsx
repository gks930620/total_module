// QR 코드 생성기
import { useState, useMemo, useRef } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { generateQr, toSvg, QR_ERROR_LEVELS } from "../lib/qr.js";

const tool = getToolBySlug("qr");

const GUIDE = {
  intro: "URL 이나 텍스트를 적으면 QR 코드가 바로 그려집니다. 오류정정 레벨과 배율을 고를 수 있고, 인쇄용 SVG 와 화면용 PNG 로 내려받을 수 있습니다. 인코딩 계산까지 전부 브라우저 안에서 일어납니다.",
  screen: {
    layout: "stack",
    left: { head: "내용 (URL · 텍스트) · 오류정정 · 배율", body: "URL 이든 아무 문자열이든" },
    right: { head: "QR 코드 미리보기", body: "SVG 저장 · PNG 저장" },
    caption: "글자를 치는 대로 QR 이 다시 그려집니다.",
  },
  example: {
    in: "WIFI:T:WPA;S:내와이파이;P:비밀번호;;",
    inLabel: "넣는 값 (Wi-Fi 접속)",
    out: `QR 코드 이미지
휴대폰 카메라로 비추면
비밀번호 입력 없이 접속`,
  },
  notes: [
    "오류정정은 L(7%)이 가장 많이 담기고 H(30%)는 일부가 가려져도 읽힙니다. 화면용이면 M, 인쇄하거나 가운데 로고를 얹을 거면 Q·H 를 권합니다.",
    "버전 6까지 지원해 오류정정 L 기준 약 134바이트, M 기준 약 106바이트를 담습니다. 한글은 한 글자가 3바이트라 L 기준 40여 글자입니다.",
    "QR 은 결국 문자열 하나를 담는 그릇입니다. URL 뿐 아니라 WIFI:T:WPA;S:이름;P:비밀번호;; · tel:010-1234-5678 · mailto:a@b.c 처럼 휴대폰이 알아듣는 형식을 그대로 적으면 됩니다.",
    "인쇄에는 SVG(벡터), 화면에는 PNG 를 쓰면 됩니다.",
    "리드-솔로몬 오류정정까지 전부 브라우저에서 계산합니다 — 넣은 내용이 서버에 남지 않습니다.",
  ],
};

export function QrPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [text, setText] = useState("https://example.com");
  const [level, setLevel] = useState("M");
  const [scale, setScale] = useState(8);
  const canvasRef = useRef(null);

  const qr = useMemo(() => generateQr(text, { level }), [text, level]);
  const svg = useMemo(() => (qr.ok ? toSvg(qr, { moduleSize: scale }) : ""), [qr, scale]);

  const update = (v) => {
    setText(v); };

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    triggerDownload(URL.createObjectURL(blob), "qr.svg");
  };

  const downloadPng = () => {
    if (!qr.ok) return;
    const quiet = 4;
    const size = (qr.size + quiet * 2) * scale;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000000";
    for (let i = 0; i < qr.size; i++) {
      for (let j = 0; j < qr.size; j++) {
        if (qr.matrix[i][j]) ctx.fillRect((j + quiet) * scale, (i + quiet) * scale, scale, scale);
      }
    }
    triggerDownload(canvas.toDataURL("image/png"), "qr.png");
  };

  return (
    <article className="tool-page">
      <ToolHeader title="QR 코드 생성기" description="URL이나 텍스트를 QR 코드로 만듭니다. 인코딩까지 전부 브라우저에서 처리합니다." />

      <div className="field">
        <span>내용 (URL · 텍스트)</span>
        <textarea
          className="area"
          rows={3}
          value={text}
          onChange={(e) => update(e.target.value)}
          placeholder="https://example.com"
          spellCheck={false}
        />
      </div>

      <div className="toolbar">
        <label className="select-label">
          오류정정
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {QR_ERROR_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </label>
        <label className="select-label">
          크기
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
            {[4, 6, 8, 12, 16].map((s) => <option key={s} value={s}>{s}배</option>)}
          </select>
        </label>
        {qr.ok && (
          <div className="toolbar-right">
            <button type="button" className="btn" onClick={downloadSvg}>SVG 저장</button>
            <button type="button" className="btn" onClick={downloadPng}>PNG 저장</button>
            <CopyButton value={() => svg} label="SVG 복사" />
          </div>
        )}
      </div>

      {!qr.ok ? (
        <div className="notice error">{qr.error}</div>
      ) : (
        <>
          {/* toSvg 는 숫자 좌표와 고정 색상만으로 문자열을 만든다 — 입력 텍스트는 매트릭스 비트로만
            들어가고 SVG 에 그대로 박히지 않는다. 그래서 이 innerHTML 에는 주입 경로가 없다. */}
        <div className="qr-stage" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="statusbar">
            <span>버전 {qr.version} ({qr.size}×{qr.size})</span>
            <span>오류정정 {qr.level}</span>
            <span>마스크 {qr.mask}</span>
            <span>{qr.byteLength} / {qr.capacity} 바이트</span>
          </div>
        </>
      )}
      <canvas ref={canvasRef} hidden />

      <ToolGuide {...GUIDE} />
    </article>
  );
}

function triggerDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
