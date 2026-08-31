// 이미지 EXIF 확인·제거 + 모자이크로 가리기
import { useState, useRef } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { loadImage, readExif, applyMosaic, canvasToBlob, downloadBlob } from "../lib/imageTools.js";
import { formatBytes } from "../lib/bytes.js";

const tool = getToolBySlug("image-privacy");

const GUIDE = {
  intro: "사진을 올리면 안에 든 촬영 정보(EXIF)를 먼저 펼쳐 보여 줍니다 — 위치·기기·촬영 시각. 그 아래 그림 위에서 가리고 싶은 곳을 드래그하면 모자이크나 검은 칠로 덮이고, 저장하면 EXIF 가 사라진 사진이 나옵니다.",
  screen: {
    layout: "stack",
    left: { head: "사진을 끌어다 놓거나 선택", body: "가릴 곳을 사진 위에서 드래그", dashed: true },
    right: { head: "촬영 정보(EXIF) → 가리기", body: "되돌리기 · 저장 (EXIF 제거됨)" },
    caption: "드래그한 영역만 덮이고, 저장할 때 EXIF 가 함께 지워집니다.",
  },
  example: {
    in: `IMG_2481.jpg
EXIF  촬영 위치 37.5665, 126.9780
      기기 iPhone · 2026-08-20 14:32`,
    inLabel: "넣는 파일",
    out: `IMG_2481.png
EXIF  없음 (위치·기기·시각 모두 제거)
가린 영역  모자이크 2곳`,
    outLabel: "나오는 파일",
  },
  notes: [
    "휴대폰으로 찍은 사진에는 촬영 위치(GPS)가 들어 있는 경우가 많습니다. 그대로 올리면 집 주소가 드러날 수 있습니다.",
    "EXIF 제거는 Canvas 로 이미지를 다시 그리는 방식입니다 — 화면에 보이는 그림만 남고 위치·기기·시각 정보는 전부 사라집니다.",
    "모자이크와 검게 칠하기는 픽셀 자체를 덮어쓰므로 되돌릴 수 없습니다.",
    "약한 블러는 복원 시도가 가능하다는 연구가 있습니다. 민감한 정보는 모자이크나 검게 칠하기를 쓰세요.",
    "전부 브라우저 안에서 처리합니다 — 개인정보를 다루는 도구인 만큼 특히 중요한 부분입니다.",
  ],
};

export function ImagePrivacyPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [file, setFile] = useState(null);
  const [exif, setExif] = useState(null);
  const [regions, setRegions] = useState([]);
  const [mode, setMode] = useState("mosaic");
  const [blockSize, setBlockSize] = useState(14);
  const [drag, setDrag] = useState(null);
  const canvasRef = useRef(null);
  const baseRef = useRef(null); // 원본 캔버스(다시 그리기용)

  // 원본 캔버스를 다시 그린 뒤 지정된 영역만 가린다 — 가림 설정을 바꿀 때마다 전부 다시 그린다
  const redraw = (rs, opts = {}) => {
    const base = baseRef.current;
    const canvas = canvasRef.current;
    if (!base || !canvas) return;
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0);
    if (rs.length) {
      applyMosaic(canvas, rs, {
        blockSize: Number(opts.blockSize ?? blockSize),
        mode: opts.mode ?? mode,
      });
    }
  };

  const open = async (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setRegions([]);

    const bytes = new Uint8Array(await f.arrayBuffer());
    setExif(readExif(bytes));

    const img = await loadImage(f);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    baseRef.current = c;
    redraw([]);
  };

  // 드래그 상자는 0~1 비율로 들고 있는다 — 화면에 그릴 때 캔버스 실제 크기를 몰라도 되고,
  // 픽셀 좌표 변환은 마우스를 뗄 때 한 번만 한다(렌더 중 ref 접근 금지).
  const toRatio = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onDown = (e) => { const p = toRatio(e); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); };
  const onMove = (e) => { if (!drag) return; const p = toRatio(e); setDrag((d) => ({ ...d, x1: p.x, y1: p.y })); };
  const onUp = () => {
    if (!drag) return;
    setDrag(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = {
      x: Math.min(drag.x0, drag.x1) * canvas.width,
      y: Math.min(drag.y0, drag.y1) * canvas.height,
      w: Math.abs(drag.x1 - drag.x0) * canvas.width,
      h: Math.abs(drag.y1 - drag.y0) * canvas.height,
    };
    if (r.w < 4 || r.h < 4) return;
    const next = [...regions, r];
    setRegions(next);
    redraw(next);
  };

  const undo = () => { const next = regions.slice(0, -1); setRegions(next); redraw(next); };
  const reset = () => { setRegions([]); redraw([]); };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    downloadBlob(blob, `${(file?.name || "image").replace(/\.[^.]+$/, "")}_안전.jpg`);
  };

  return (
    <article className="tool-page">
      <ToolHeader title="사진 개인정보 지우기" description="위치정보(EXIF)를 확인해 지우고, 가리고 싶은 부분을 모자이크로 덮습니다." />

      <div className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); open(e.dataTransfer.files?.[0]); }}>
        <span className="material-icons">shield</span>
        <p>사진을 끌어다 놓거나 선택하세요 · 업로드되지 않습니다</p>
        <label className="btn primary">사진 선택
          <input type="file" accept="image/*" hidden onChange={(e) => open(e.target.files?.[0])} />
        </label>
        {file && <p className="hint">{file.name} · {formatBytes(file.size)}</p>}
      </div>

      {exif && (
        <>
          <h2 className="sub-heading">촬영 정보 (EXIF)</h2>
          {exif.gps ? (
            <div className="notice error">
              <strong>⚠ 촬영 위치가 들어 있습니다</strong> — 위도 {exif.gps.latitude.toFixed(6)}, 경도 {exif.gps.longitude.toFixed(6)}.
              이대로 공유하면 촬영 장소가 노출됩니다. 아래에서 저장하면 제거됩니다.
              {" "}<a href={`https://www.google.com/maps?q=${exif.gps.latitude},${exif.gps.longitude}`} target="_blank" rel="noopener noreferrer">지도에서 보기</a>
            </div>
          ) : exif.hasExif ? (
            <div className="notice warn">촬영 기기·일시 정보가 들어 있습니다. 위치정보(GPS)는 없습니다.</div>
          ) : (
            <div className="notice ok">EXIF 정보가 없습니다.{exif.note ? ` (${exif.note})` : ""}</div>
          )}

          {exif.tags.length > 0 && (
            <div className="kv-card">
              {exif.tags.map((t) => (
                <div className="kv-row" key={t.tag}>
                  <span className="kv-label">{t.label}</span>
                  <span className="kv-value mono">{String(t.value)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {file && (
        <>
          <h2 className="sub-heading">가리기</h2>
          <div className="toolbar">
            <div className="seg">
              <button type="button" className={mode === "mosaic" ? "on" : ""} onClick={() => { setMode("mosaic"); redraw(regions, { mode: "mosaic" }); }}>모자이크</button>
              <button type="button" className={mode === "blur" ? "on" : ""} onClick={() => { setMode("blur"); redraw(regions, { mode: "blur" }); }}>블러</button>
              <button type="button" className={mode === "blackout" ? "on" : ""} onClick={() => { setMode("blackout"); redraw(regions, { mode: "blackout" }); }}>검게 칠하기</button>
            </div>
            {mode === "mosaic" && (
              <div className="field"><span>블록 크기 {blockSize}</span>
                <input type="range" min="4" max="40" value={blockSize} onChange={(e) => { setBlockSize(e.target.value); redraw(regions, { blockSize: e.target.value }); }} /></div>
            )}
            <div className="toolbar-right">
              <button type="button" className="btn" onClick={undo} disabled={!regions.length}>되돌리기</button>
              <button type="button" className="btn ghost" onClick={reset}>모두 지우기</button>
              <button type="button" className="btn primary" onClick={save}>저장 (EXIF 제거됨)</button>
            </div>
          </div>

          <p className="hint">가리고 싶은 부분을 <b>드래그</b>하세요. 여러 번 칠할 수 있습니다. ({regions.length}곳 적용)</p>

          <div className="canvas-stage"
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
            <canvas ref={canvasRef} />
            {drag && (
              <div className="drag-box" style={{
                left: `${Math.min(drag.x0, drag.x1) * 100}%`,
                top: `${Math.min(drag.y0, drag.y1) * 100}%`,
                width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
                height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
              }} />
            )}
          </div>

          <div className="notice warn">
            <strong>블러는 복원 시도가 가능합니다.</strong> 계좌번호·주소처럼 민감한 정보는 <b>모자이크</b>나 <b>검게 칠하기</b>를 쓰세요.
          </div>
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
