// 이미지 리사이즈 · 압축 · 포맷 변환 · 회전 (Canvas, 업로드 없음)
import { useState, useCallback } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import {
  loadImage, computeSize, transformImage, downloadBlob,
  IMAGE_FORMATS, PHOTO_SPECS, mmToPx,
} from "../lib/imageTools.js";
import { formatBytes } from "../lib/bytes.js";
import { makeSamplePhoto } from "../lib/sampleFiles.js";

const tool = getToolBySlug("image");

const GUIDE = {
  intro: "사진을 끌어다 놓고 목표 크기와 형식을 정한 뒤 '변환' 을 누르면 됩니다. 여러 장을 한꺼번에 처리하고, 장마다 원본 대비 용량이 얼마나 줄었는지 보여 줍니다. 회전·좌우 뒤집기와 증명사진 규격 적용도 같은 화면에서 합니다.",
  screen: {
    layout: "stack",
    left: { head: "이미지를 끌어다 놓거나 선택 (여러 장)", body: "크기 기준 · 형식 · 품질 · 회전 정하기", dashed: true },
    right: { head: "장마다 미리보기와 용량 변화", body: "장별 저장 · 전체 저장" },
    caption: "설정을 정하고 '변환' 을 누르면 아래에 결과가 쌓입니다.",
  },
  example: {
    in: `photo.jpg  4032×3024 · 3.8MB
가로 기준 1920px · JPG 품질 85%`,
    inLabel: "넣는 값",
    out: `photo_1920x1440.jpg
1920×1440 · 420KB  (약 89% 감소)`,
    outLabel: "나오는 파일",
  },
  notes: [
    "여권·주민등록증·이력서 같은 증명사진은 표에서 '적용' 을 누르면 300dpi 규격 픽셀이 자동으로 채워집니다.",
    "그 밖의 크기는 '방식' 에서 고릅니다 — 가로 기준 · 세로 기준 · 상자에 맞춤 · 정확히(비율 무시) · 퍼센트.",
    "줄일 때는 화질 차이가 거의 없습니다. JPG·WebP 는 품질 슬라이더로 조절하고, PNG 는 무손실이라 품질 설정이 없습니다.",
    "WebP 는 같은 화질에서 JPG 보다 25~35% 작습니다. 최신 브라우저는 모두 지원합니다.",
    "JPG 는 투명도를 지원하지 않아 PNG 를 JPG 로 바꾸면 투명한 부분을 지정한 배경색(기본 흰색)으로 채웁니다.",
    "Canvas 로 다시 그리므로 EXIF 가 모두 사라집니다 — 촬영 위치(GPS)도 함께 지워집니다.",
    "브라우저 안에서만 처리합니다. 파일이 기기 밖으로 나가지 않으며, 개발자도구 네트워크 탭에서 확인할 수 있습니다.",
  ],
};

export function ImagePage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [items, setItems] = useState([]); // { file, img, result }
  const [mode, setMode] = useState("width");
  const [targetWidth, setTargetWidth] = useState(1920);
  const [targetHeight, setTargetHeight] = useState(1080);
  const [percent, setPercent] = useState(50);
  const [type, setType] = useState("image/jpeg");
  const [quality, setQuality] = useState(85);
  const [rotate, setRotate] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [background, setBackground] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const loaded = [];
    for (const file of files) {
      try {
        const img = await loadImage(file);
        loaded.push({ file, img, result: null, id: `${file.name}-${file.size}-${loaded.length}` });
      } catch { /* 읽지 못한 파일은 건너뛴다 */ }
    }
    setItems((prev) => [...prev, ...loaded]);
  }, []);

  const run = async () => {
    if (!items.length) return;
    setBusy(true);
    const out = [];
    for (const it of items) {
      const size = computeSize({
        width: it.img.naturalWidth, height: it.img.naturalHeight,
        mode, targetWidth, targetHeight, percent,
      });
      if (!size.ok) { out.push({ ...it, result: null, error: size.reason }); continue; }
      const r = await transformImage(it.img, {
        width: size.width, height: size.height, rotate, flipH, flipV,
        type, quality: quality / 100, background,
      });
      out.push({ ...it, result: { ...r, url: URL.createObjectURL(r.blob) }, error: null });
    }
    setItems(out);
    setBusy(false);
  };

  const fmt = IMAGE_FORMATS.find((f) => f.key === type);
  const totalBefore = items.reduce((a, i) => a + i.file.size, 0);
  const totalAfter = items.reduce((a, i) => a + (i.result?.blob.size || 0), 0);

  const downloadAll = () => {
    items.forEach((it, i) => {
      if (!it.result) return;
      const base = it.file.name.replace(/\.[^.]+$/, "");
      setTimeout(() => downloadBlob(it.result.blob, `${base}_${it.result.width}x${it.result.height}.${fmt.ext}`), i * 150);
    });
  };

  return (
    <article className="tool-page">
      <ToolHeader title="이미지 리사이즈 · 변환" description="크기를 줄이고 포맷을 바꿉니다. 파일은 기기 밖으로 나가지 않습니다." />

      <div
        className={`dropzone ${dragOver ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
      >
        <span className="material-icons">add_photo_alternate</span>
        <p>이미지를 끌어다 놓거나 선택하세요 · 여러 장 동시 처리 가능</p>
        <label className="btn primary">
          이미지 선택
          <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </label>
        <button type="button" className="btn" onClick={async () => addFiles([await makeSamplePhoto()])}>
          예시 이미지로 해보기
        </button>
      </div>

      {items.length > 0 && (
        <>
          <h2 className="sub-heading">증명사진 규격 참고</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>용도</th><th>크기(mm)</th><th>300dpi 픽셀</th><th></th></tr></thead>
              <tbody>
                {PHOTO_SPECS.map((s) => (
                  <tr key={s.key}>
                    <td>{s.label}</td>
                    <td className="mono">{s.mm[0]}×{s.mm[1]}</td>
                    <td className="mono">{mmToPx(s.mm[0])}×{mmToPx(s.mm[1])}</td>
                    <td><button type="button" className="btn" onClick={() => { setMode("exact"); setTargetWidth(mmToPx(s.mm[0])); setTargetHeight(mmToPx(s.mm[1])); }}>적용</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="sub-heading">크기</h2>
          <div className="toolbar">
            <label className="select-label">방식
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="width">가로 기준</option>
                <option value="height">세로 기준</option>
                <option value="fit">상자에 맞춤</option>
                <option value="exact">정확히 (비율 무시)</option>
                <option value="percent">퍼센트</option>
              </select>
            </label>
            {(mode === "width" || mode === "fit" || mode === "exact") && (
              <div className="field"><span>가로 px</span><input className="krw-input small" value={targetWidth} onChange={(e) => setTargetWidth(e.target.value)} inputMode="numeric" /></div>
            )}
            {(mode === "height" || mode === "fit" || mode === "exact") && (
              <div className="field"><span>세로 px</span><input className="krw-input small" value={targetHeight} onChange={(e) => setTargetHeight(e.target.value)} inputMode="numeric" /></div>
            )}
            {mode === "percent" && (
              <div className="field"><span>비율 %</span><input className="krw-input small" value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="numeric" /></div>
            )}
          </div>

          <h2 className="sub-heading">형식 · 회전</h2>
          <div className="toolbar">
            <div className="seg">
              {IMAGE_FORMATS.map((f) => (
                <button key={f.key} type="button" className={type === f.key ? "on" : ""} onClick={() => setType(f.key)}>{f.label}</button>
              ))}
            </div>
            {fmt?.quality && (
              <div className="field grow"><span>품질 {quality}%</span>
                <input type="range" min="30" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></div>
            )}
            <label className="select-label">회전
              <select value={rotate} onChange={(e) => setRotate(Number(e.target.value))}>
                {[0, 90, 180, 270].map((d) => <option key={d} value={d}>{d}°</option>)}
              </select>
            </label>
            <label className="check-inline"><input type="checkbox" checked={flipH} onChange={(e) => setFlipH(e.target.checked)} />좌우반전</label>
            <label className="check-inline"><input type="checkbox" checked={flipV} onChange={(e) => setFlipV(e.target.checked)} />상하반전</label>
            {type === "image/jpeg" && (
              <div className="field"><span>투명 배경 채울 색</span>
                <input type="color" className="color-picker" value={background} onChange={(e) => setBackground(e.target.value)} /></div>
            )}
          </div>
          <p className="hint">{fmt?.note}</p>

          <div className="toolbar">
            <button type="button" className="btn primary" onClick={run} disabled={busy}>{busy ? "변환 중…" : `${items.length}장 변환`}</button>
            {totalAfter > 0 && <button type="button" className="btn" onClick={downloadAll}>전체 저장</button>}
            <button type="button" className="btn ghost" onClick={() => setItems([])}>비우기</button>
            {totalAfter > 0 && (
              <div className="toolbar-right statusbar" style={{ margin: 0 }}>
                <span>{formatBytes(totalBefore)} → <b>{formatBytes(totalAfter)}</b></span>
                <span className="tag ok">{Math.round((1 - totalAfter / totalBefore) * 100)}% 감소</span>
              </div>
            )}
          </div>

          <div className="img-grid">
            {items.map((it) => (
              <div className="img-card" key={it.id}>
                <div className="img-thumb">
                  <img src={it.result?.url || URL.createObjectURL(it.file)} alt={it.file.name} />
                </div>
                <div className="img-meta">
                  <strong title={it.file.name}>{it.file.name}</strong>
                  <span className="muted">{it.img.naturalWidth}×{it.img.naturalHeight} · {formatBytes(it.file.size)}</span>
                  {it.error && <span className="tag warn">{it.error}</span>}
                  {it.result && (
                    <>
                      <span className="tag ok">{it.result.width}×{it.result.height} · {formatBytes(it.result.blob.size)}</span>
                      <button type="button" className="btn" onClick={() => downloadBlob(it.result.blob, `${it.file.name.replace(/\.[^.]+$/, "")}_${it.result.width}x${it.result.height}.${fmt.ext}`)}>저장</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
