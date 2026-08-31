// 파비콘 세트 생성 + 이미지 색 팔레트 추출
import { useState, useCallback } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { loadImage, canvasToBlob, downloadBlob, extractPalette, FAVICON_SIZES } from "../lib/imageTools.js";
import { makeSampleLogo } from "../lib/sampleFiles.js";

const tool = getToolBySlug("favicon");

const HTML_SNIPPET = `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />`;

const GUIDE = {
  intro: "로고 이미지 하나를 끌어다 놓으면 브라우저 탭·아이폰 홈 화면·안드로이드 PWA 에 필요한 크기를 한 번에 만들어 줍니다. 가운데를 정사각형으로 잘라 각 크기로 줄이고, 붙여넣을 HTML 코드와 이미지에서 뽑은 대표 색도 함께 줍니다.",
  screen: {
    layout: "stack",
    left: { head: "이미지를 끌어다 놓거나 선택", body: "정사각형 512px 이상 PNG 권장", dashed: true },
    right: { head: "크기별 미리보기 → HTML 코드 → 팔레트", body: "전체 저장 · 크기마다 개별 저장" },
    caption: "이미지를 놓으면 아래에 크기별 결과가 한꺼번에 나옵니다.",
  },
  example: {
    in: "logo.png  (512×512)",
    inLabel: "넣는 파일",
    out: `favicon-16.png       탭
favicon-32.png       탭
apple-touch-icon.png 아이폰 홈 화면
favicon-192.png      안드로이드 PWA
favicon-512.png      안드로이드 PWA`,
    outLabel: "나오는 파일",
  },
  notes: [
    "16·32 는 브라우저 탭, 180 은 아이폰 홈 화면, 192·512 는 안드로이드 PWA 용입니다.",
    ".ico 는 만들지 않습니다 — 요즘 브라우저는 PNG 파비콘을 잘 지원합니다. 아주 오래된 IE 가 필요하면 별도 변환기를 쓰세요.",
    "작은 크기에서도 알아볼 수 있게 단순한 도형·글자로 된 원본이 좋습니다. 배경은 투명·흰색·검정 중에 고를 수 있습니다.",
    "뽑아낸 대표 색은 theme-color 메타 태그에 넣으면 모바일 브라우저 주소창 색이 바뀝니다.",
    "이미지는 브라우저 안에서만 처리합니다. 어디에도 올라가지 않습니다.",
  ],
};

export function FaviconPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [name, setName] = useState("");
  const [icons, setIcons] = useState([]);
  const [palette, setPalette] = useState([]);
  const [background, setBackground] = useState("transparent");

  const open = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setName(file.name);
    const image = await loadImage(file);

    // 팔레트 추출용 캔버스
    const pc = document.createElement("canvas");
    pc.width = Math.min(image.naturalWidth, 400);
    pc.height = Math.round((image.naturalHeight * pc.width) / image.naturalWidth);
    pc.getContext("2d").drawImage(image, 0, 0, pc.width, pc.height);
    setPalette(extractPalette(pc, 6));

    // 파비콘 세트 생성
    const made = [];
    for (const size of FAVICON_SIZES) {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      if (background !== "transparent") { ctx.fillStyle = background; ctx.fillRect(0, 0, size, size); }
      // 정사각형으로 가운데 크롭
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const sx = (image.naturalWidth - side) / 2;
      const sy = (image.naturalHeight - side) / 2;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
      const blob = await canvasToBlob(c, "image/png");
      made.push({ size, blob, url: URL.createObjectURL(blob) });
    }
    setIcons(made);
  }, [background]);

  const downloadAll = () => {
    icons.forEach((ic, i) => {
      const fname = ic.size === 180 ? "apple-touch-icon.png" : `favicon-${ic.size}.png`;
      setTimeout(() => downloadBlob(ic.blob, fname), i * 150);
    });
  };

  return (
    <article className="tool-page">
      <ToolHeader title="파비콘 생성 · 색 추출" description="로고 이미지 하나로 필요한 파비콘 크기를 한 번에 만듭니다." />

      <div className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); open(e.dataTransfer.files?.[0]); }}>
        <span className="material-icons">image</span>
        <p>로고 이미지를 끌어다 놓거나 선택하세요 (정사각형 512px 이상 권장)</p>
        <label className="btn primary">이미지 선택
          <input type="file" accept="image/*" hidden onChange={(e) => open(e.target.files?.[0])} />
        </label>
        <button type="button" className="btn" onClick={async () => open(await makeSampleLogo())}>
          예시 로고로 해보기
        </button>
        {name && <p className="hint">{name}</p>}
      </div>

      {icons.length > 0 && (
        <>
          <div className="toolbar">
            <button type="button" className="btn primary" onClick={downloadAll}>전체 저장 ({icons.length}개)</button>
            <label className="select-label">배경
              <select value={background} onChange={(e) => setBackground(e.target.value)}>
                <option value="transparent">투명</option>
                <option value="#ffffff">흰색</option>
                <option value="#000000">검정</option>
              </select>
            </label>
          </div>

          <div className="favicon-grid">
            {icons.map((ic) => (
              <div className="favicon-item" key={ic.size}>
                <div className="favicon-box" style={{ width: Math.min(ic.size, 96), height: Math.min(ic.size, 96) }}>
                  <img src={ic.url} alt={`${ic.size}px`} width={Math.min(ic.size, 96)} height={Math.min(ic.size, 96)} />
                </div>
                <span className="mono">{ic.size}×{ic.size}</span>
                <button type="button" className="btn" onClick={() => downloadBlob(ic.blob, ic.size === 180 ? "apple-touch-icon.png" : `favicon-${ic.size}.png`)}>저장</button>
              </div>
            ))}
          </div>

          <h2 className="sub-heading">HTML 삽입 코드<CopyButton value={() => HTML_SNIPPET} label="복사" /></h2>
          <textarea className="area code readonly" rows={5} value={HTML_SNIPPET} readOnly spellCheck={false} />
        </>
      )}

      {palette.length > 0 && (
        <>
          <h2 className="sub-heading">이미지에서 뽑은 색</h2>
          <div className="palette-row">
            {palette.map((c) => (
              <div className="palette-item" key={c.hex}>
                <div className="palette-chip" style={{ background: c.hex }} />
                <code>{c.hex}</code>
                <CopyButton value={() => c.hex} label="복사" />
              </div>
            ))}
          </div>
          <p className="hint">
            대표 색을 <code className="chip-inline">&lt;meta name="theme-color" content="{palette[0].hex}"&gt;</code> 로 쓰면
            모바일 브라우저 주소창 색이 바뀝니다.
          </p>
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
