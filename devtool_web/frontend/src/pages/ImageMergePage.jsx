// 이미지 여러 장 이어붙이기 (캡처 스티치)
import { useState, useCallback } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { loadImage, mergeImages, downloadBlob } from "../lib/imageTools.js";
import { makeSampleCaptures } from "../lib/sampleFiles.js";
import { formatBytes } from "../lib/bytes.js";

const tool = getToolBySlug("image-merge");

const GUIDE = {
  intro: "여러 번 나눠 찍은 캡처를 한 장으로 이어붙입니다. 이미지를 끌어다 놓으면 고른 순서대로 목록이 만들어지고, ↑↓ 로 순서를 고친 뒤 세로·가로 방향과 간격·배경색을 정해 합칩니다.",
  screen: {
    layout: "stack",
    left: { head: "이미지를 끌어다 놓거나 선택 (여러 장)", body: "아래 목록에서 ↑↓ 로 순서 바꾸기 · ✕ 로 빼기", dashed: true },
    right: { head: "방향 · 맞춤 · 간격 · 배경 → 합치기", body: "결과 미리보기 · PNG 저장" },
    caption: "두 장 이상 넣어야 '합치기' 가 눌립니다.",
  },
  example: {
    in: `캡처1.png  (1080×1920)
캡처2.png  (1080×1560)
방향: 세로 · 간격 0`,
    inLabel: "넣는 값",
    out: "merged.png  (1080×3480)",
    outLabel: "나오는 파일",
  },
  notes: [
    "긴 웹페이지나 대화창을 여러 번 캡처했을 때 한 장으로 잇는 용도입니다. 가로로 붙이면 비교 이미지가 됩니다.",
    "크기가 달라도 됩니다 — '가로 맞춤' 을 켜면 가장 좁은 이미지에 맞춰 나머지를 줄이고, 끄면 원본 크기 그대로 두고 빈 곳을 배경색으로 채웁니다.",
    "순서는 파일을 고른 순서가 기본이고, 각 줄의 ↑↓ 버튼으로 옮깁니다.",
    "장수 제한은 없지만 전체 픽셀이 너무 크면 브라우저가 버거워합니다. 세로로 아주 긴 이미지는 20장 안쪽을 권합니다.",
    "합치는 일은 브라우저 안에서만 일어납니다. 이미지가 기기 밖으로 나가지 않습니다.",
  ],
};

export function ImageMergePage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [items, setItems] = useState([]);
  const [direction, setDirection] = useState("vertical");
  const [unify, setUnify] = useState("width");
  const [align, setAlign] = useState("center");
  const [gap, setGap] = useState(0);
  const [background, setBackground] = useState("#ffffff");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const addFiles = useCallback(async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const loaded = [];
    for (const file of files) {
      try { loaded.push({ file, img: await loadImage(file), id: `${file.name}-${file.size}-${Math.random()}` }); }
      catch { /* skip */ }
    }
    setItems((prev) => [...prev, ...loaded]);
  }, []);

  const move = (i, dir) => {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const run = async () => {
    if (items.length < 2) return;
    setBusy(true);
    const r = await mergeImages(items.map((i) => i.img), {
      direction, align, gap: Number(gap), background,
      unify: unify === "none" ? "none" : direction === "vertical" ? "width" : "height",
      type: "image/png",
    });
    setResult({ ...r, url: URL.createObjectURL(r.blob) });
    setBusy(false);
  };

  return (
    <article className="tool-page">
      <ToolHeader title="이미지 이어붙이기" description="캡처 여러 장을 한 장으로 합칩니다. 업로드되지 않습니다." />

      <div className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
        <span className="material-icons">burst_mode</span>
        <p>이미지 여러 장을 끌어다 놓거나 선택하세요</p>
        <label className="btn primary">이미지 선택
          <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </label>
        <button type="button" className="btn" onClick={async () => addFiles(await makeSampleCaptures())}>
          예시 캡처 2장으로 해보기
        </button>
      </div>

      {items.length > 0 && (
        <>
          <h2 className="sub-heading">순서 ({items.length}장)</h2>
          <div className="merge-list">
            {items.map((it, i) => (
              <div className="merge-item" key={it.id}>
                <span className="merge-no">{i + 1}</span>
                <img src={URL.createObjectURL(it.file)} alt="" />
                <div className="merge-meta">
                  <strong>{it.file.name}</strong>
                  <span className="muted">{it.img.naturalWidth}×{it.img.naturalHeight}</span>
                </div>
                <div className="merge-actions">
                  <button type="button" className="btn icon" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" className="btn icon" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
                  <button type="button" className="btn icon" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div className="toolbar">
            <div className="seg">
              <button type="button" className={direction === "vertical" ? "on" : ""} onClick={() => setDirection("vertical")}>세로로</button>
              <button type="button" className={direction === "horizontal" ? "on" : ""} onClick={() => setDirection("horizontal")}>가로로</button>
            </div>
            <label className="check-inline">
              <input type="checkbox" checked={unify !== "none"} onChange={(e) => setUnify(e.target.checked ? "width" : "none")} />
              {direction === "vertical" ? "가로 크기 맞춤" : "세로 크기 맞춤"}
            </label>
            <label className="select-label">정렬
              <select value={align} onChange={(e) => setAlign(e.target.value)}>
                <option value="center">가운데</option><option value="start">시작</option><option value="end">끝</option>
              </select>
            </label>
            <div className="field"><span>간격 px</span><input className="krw-input small" value={gap} onChange={(e) => setGap(e.target.value)} inputMode="numeric" /></div>
            <div className="field"><span>배경</span><input type="color" className="color-picker" value={background} onChange={(e) => setBackground(e.target.value)} /></div>
          </div>

          <div className="toolbar">
            <button type="button" className="btn primary" onClick={run} disabled={busy || items.length < 2}>
              {busy ? "합치는 중…" : "이어붙이기"}
            </button>
            {result && <button type="button" className="btn" onClick={() => downloadBlob(result.blob, "merged.png")}>PNG 저장</button>}
            <button type="button" className="btn ghost" onClick={() => { setItems([]); setResult(null); }}>비우기</button>
          </div>

          {result && (
            <>
              <div className="statusbar">
                <span>결과 <b>{result.width}×{result.height}</b></span>
                <span>{formatBytes(result.blob.size)}</span>
              </div>
              <div className="canvas-stage scroll">
                <img src={result.url} alt="합친 결과" style={{ maxWidth: "100%" }} />
              </div>
            </>
          )}
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
