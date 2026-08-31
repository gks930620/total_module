// PDF 합치기 · 나누기·추출 · 이미지→PDF · 메타데이터 제거
// pdf-lib 은 무거워서 이 페이지에 들어왔을 때만 동적 import 된다(pdfTools.loadPdfLib).
import { useState, useCallback } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import {
  inspectPdf, mergePdfs, splitPdf, extractPages, imagesToPdf, stripMetadata,
  parsePageRange, makeSamplePdf, PDF_PAGE_PRESETS,
} from "../lib/pdfTools.js";
import { makeSampleCaptures } from "../lib/sampleFiles.js";
import { downloadBlob } from "../lib/imageTools.js";
import { formatBytes } from "../lib/bytes.js";

const tool = getToolBySlug("pdf");

const GUIDE = {
  intro: "위 탭에서 할 일을 고르고 PDF 를 끌어다 놓으면 됩니다 — 여러 파일 합치기, 몇 장씩 나누거나 범위만 뽑기, 이미지를 PDF 로 묶기, 작성자 같은 메타데이터 지우기. 파일은 브라우저 안에서만 열립니다.",
  screen: {
    layout: "stack",
    left: { head: "탭: 합치기 · 나누기·추출 · 이미지→PDF · 메타데이터 제거", body: "PDF 를 끌어다 놓거나 선택", dashed: true },
    right: { head: "불러온 파일 → 결과", body: "결과마다 저장 버튼" },
    caption: "탭을 먼저 고르고 파일을 놓으면 그 작업에 맞는 설정이 나옵니다.",
  },
  example: {
    in: `계약서_1.pdf  (3장)
계약서_2.pdf  (5장)
탭: 합치기`,
    inLabel: "넣는 파일",
    out: "merged.pdf  (8장)",
    outLabel: "나오는 파일",
  },
  notes: [
    "나누기는 '몇 장씩' 으로 균등 분할하거나 '1-3, 5, 8-' 처럼 범위를 적어 필요한 페이지만 뽑을 수 있습니다.",
    "메타데이터 제거는 이력서에서 특히 씁니다 — 문서를 열어도 안 보이지만 속성에는 이전 회사 이름이나 본명이 '작성자' 로 남아 있는 경우가 흔합니다.",
    "PPT·워드를 PDF 로 바꾸거나 그 반대는 되지 않습니다. 폰트 배치·줄바꿈을 계산하는 레이아웃 엔진이 필요한데 브라우저에서는 불가능합니다 — 오피스·한글의 '다른 이름으로 저장 → PDF' 를 쓰세요.",
    "열람 암호가 걸린 파일은 열지 못합니다. 편집 제한만 걸린 파일은 처리되는 경우가 있습니다.",
    "브라우저 안에서 pdf-lib 으로 편집합니다. 계약서·이력서처럼 남에게 보이면 안 되는 문서도 기기 밖으로 나가지 않습니다.",
  ],
};

const TABS = [
  { key: "merge", label: "합치기" },
  { key: "split", label: "나누기 · 추출" },
  { key: "image", label: "이미지 → PDF" },
  { key: "meta", label: "메타데이터 제거" },
];

export function PdfPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [tab, setTab] = useState("merge");
  const [files, setFiles] = useState([]);       // { file, info }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [rangeSpec, setRangeSpec] = useState("1-3");
  const [everyN, setEveryN] = useState(1);
  const [pageSize, setPageSize] = useState("fit");
  const [outputs, setOutputs] = useState([]);

  const addFiles = useCallback(async (fileList, accept = "pdf") => {
    const wanted = [...fileList].filter((f) =>
      accept === "pdf" ? /\.pdf$/i.test(f.name) || f.type === "application/pdf" : f.type.startsWith("image/"));
    if (!wanted.length) return;
    setBusy(true);
    setError(null);
    try {
      const loaded = [];
      for (const file of wanted) {
        const info = accept === "pdf" ? await inspectPdf(file) : { ok: true, name: file.name, size: file.size, pageCount: 1 };
        loaded.push({ file, info, id: `${file.name}-${file.size}-${Math.random()}` });
      }
      setFiles((prev) => [...prev, ...loaded]);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }, []);

  const reset = () => { setFiles([]); setOutputs([]); setError(null); };

  // 탭마다 필요한 게 다르다 — 합치기는 두 개, 나머지는 한 개(이미지 탭은 이미지 두 장).
  const loadSample = async () => {
    setBusy(true);
    setError(null);
    try {
      reset();
      if (isImageTab) {
        addFiles(await makeSampleCaptures(), "image");
      } else if (tab === "merge") {
        addFiles([await makeSamplePdf("계약서_1.pdf", 3), await makeSamplePdf("계약서_2.pdf", 5)], "pdf");
      } else {
        addFiles([await makeSamplePdf("보고서.pdf", 8)], "pdf");
      }
    } catch (e) {
      setError(`예시를 만들지 못했습니다: ${e.message}`);
    }
    setBusy(false);
  };

  const guard = async (fn) => {
    setBusy(true); setError(null); setOutputs([]);
    try { await fn(); } catch (e) { setError(`처리 실패: ${e.message}`); }
    setBusy(false);
  };

  const doMerge = () => guard(async () => {
    if (files.length < 2) throw new Error("PDF 를 2개 이상 넣어 주세요.");
    const r = await mergePdfs(files.map((f) => f.file));
    setOutputs([{ name: "merged.pdf", bytes: r.bytes, label: `${r.pageCount}쪽` }]);
  });

  const doSplit = () => guard(async () => {
    const chunks = await splitPdf(files[0].file, { everyN: Number(everyN) });
    setOutputs(chunks.map((c, i) => ({ name: `split_${i + 1}_${c.label}.pdf`, bytes: c.bytes, label: c.label })));
  });

  const doExtract = () => guard(async () => {
    const total = files[0].info.pageCount;
    const indices = parsePageRange(rangeSpec, total);
    if (!indices.length) throw new Error("추출할 페이지를 찾지 못했습니다. 예) 1-3, 5");
    const r = await extractPages(files[0].file, indices);
    setOutputs([{ name: `extract_${rangeSpec.replace(/[^\w-]/g, "")}.pdf`, bytes: r.bytes, label: `${r.pageCount}쪽` }]);
  });

  const doImages = () => guard(async () => {
    const r = await imagesToPdf(files.map((f) => f.file), { pageSize });
    if (!r.ok) throw new Error(r.reason);
    setOutputs([{ name: "images.pdf", bytes: r.bytes, label: `${r.pageCount}쪽` }]);
  });

  const doStrip = () => guard(async () => {
    const r = await stripMetadata(files[0].file);
    setOutputs([{ name: `${files[0].file.name.replace(/\.pdf$/i, "")}_정리.pdf`, bytes: r.bytes, label: `${r.removed.length}개 항목 제거` }]);
  });

  const save = (o) => downloadBlob(new Blob([o.bytes], { type: "application/pdf" }), o.name);
  const first = files[0];
  const isImageTab = tab === "image";

  return (
    <article className="tool-page">
      <ToolHeader title="PDF 편집" description="합치고 나누고 필요한 쪽만 뽑습니다. 파일이 기기 밖으로 나가지 않습니다." />

      <div className="chip-row">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`chip ${tab === t.key ? "on" : ""}`}
            onClick={() => { setTab(t.key); reset(); }}>{t.label}</button>
        ))}
      </div>

      <div className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files, isImageTab ? "image" : "pdf"); }}>
        <span className="material-icons">{isImageTab ? "add_photo_alternate" : "picture_as_pdf"}</span>
        <p>{isImageTab ? "이미지(JPG·PNG)를" : "PDF 파일을"} 끌어다 놓거나 선택하세요 · 업로드되지 않습니다</p>
        <label className="btn primary">
          파일 선택
          <input type="file" accept={isImageTab ? "image/*" : "application/pdf"}
            multiple={tab === "merge" || isImageTab} hidden
            onChange={(e) => addFiles(e.target.files, isImageTab ? "image" : "pdf")} />
        </label>
        <button type="button" className="btn" onClick={loadSample} disabled={busy}>
          예시 파일로 해보기
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}
      {busy && <div className="notice">처리 중입니다…</div>}

      {files.length > 0 && (
        <>
          <h2 className="sub-heading">불러온 파일 ({files.length}개)</h2>
          <div className="kv-card">
            {files.map((f, i) => (
              <div className="kv-row" key={f.id}>
                <span className="kv-label">{i + 1}</span>
                <span className="kv-value">
                  <strong>{f.file.name}</strong>
                  <small className="muted block">
                    {formatBytes(f.file.size)}
                    {f.info?.ok && f.info.pageCount ? ` · ${f.info.pageCount}쪽` : ""}
                    {f.info?.ok === false ? ` · ${f.info.reason}` : ""}
                  </small>
                </span>
                <button type="button" className="btn icon" onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}>✕</button>
              </div>
            ))}
          </div>

          <div className="toolbar">
            {tab === "merge" && <button type="button" className="btn primary" onClick={doMerge} disabled={busy || files.length < 2}>순서대로 합치기</button>}

            {tab === "split" && (
              <>
                <div className="field"><span>몇 장씩 나눌까요</span>
                  <input className="krw-input small" value={everyN} onChange={(e) => setEveryN(e.target.value)} inputMode="numeric" /></div>
                <button type="button" className="btn primary" onClick={doSplit} disabled={busy}>나누기</button>
                <div className="field grow"><span>또는 범위 추출 (예: 1-3, 5, 8-)</span>
                  <input className="krw-input" value={rangeSpec} onChange={(e) => setRangeSpec(e.target.value)} /></div>
                <button type="button" className="btn" onClick={doExtract} disabled={busy}>범위만 추출</button>
              </>
            )}

            {tab === "image" && (
              <>
                <label className="select-label">페이지 크기
                  <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                    {PDF_PAGE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </label>
                <button type="button" className="btn primary" onClick={doImages} disabled={busy}>PDF 로 만들기</button>
              </>
            )}

            {tab === "meta" && <button type="button" className="btn primary" onClick={doStrip} disabled={busy}>메타데이터 지우기</button>}

            <button type="button" className="btn ghost" onClick={reset}>비우기</button>
          </div>

          {tab === "meta" && first?.info?.ok && (
            <div className="kv-card">
              {Object.entries(first.info.meta).map(([k, v]) => (
                <div className="kv-row" key={k}>
                  <span className="kv-label">{k}</span>
                  <span className="kv-value mono">{v || <em className="muted">(비어 있음)</em>}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {outputs.length > 0 && (
        <>
          <h2 className="sub-heading">결과 ({outputs.length}개)</h2>
          <div className="kv-card">
            {outputs.map((o, i) => (
              <div className="kv-row" key={i}>
                <span className="kv-label">{o.label}</span>
                <span className="kv-value mono">{o.name} · {formatBytes(o.bytes.length)}</span>
                <button type="button" className="btn primary" onClick={() => save(o)}>저장</button>
              </div>
            ))}
          </div>
          {outputs.length > 1 && (
            <button type="button" className="btn" onClick={() => outputs.forEach((o, i) => setTimeout(() => save(o), i * 200))}>전체 저장</button>
          )}
        </>
      )}

      <div className="notice">
        <strong>할 수 없는 것</strong> — PPT·워드 → PDF, PDF → 워드 변환은 브라우저에서 불가능합니다(레이아웃 엔진 필요).
        스캔한 PDF 의 글자 인식(OCR)도 지원하지 않습니다.
      </div>

      <ToolGuide {...GUIDE} />
    </article>
  );
}
