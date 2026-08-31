// PDF 편집 — pdf-lib 사용. 파일이 브라우저 밖으로 나가지 않는다(NFR-02).
//
// 계약서·이력서를 남의 서버에 올리지 않고 합치거나 나눌 수 있다는 게 이 도구군의 가치다.
// pdf-lib 은 무거우므로(약 300KB) 이 모듈은 **필요할 때만 동적 import** 한다 → loadPdfLib()
//
// ⚠️ 할 수 있는 것과 없는 것
//   할 수 있음: 합치기·나누기·회전·삭제·순서변경·이미지→PDF·메타데이터 제거·암호 설정
//   할 수 없음: pptx/docx → PDF, PDF → Word (레이아웃 엔진 필요),
//               스캔 PDF 의 글자 인식(OCR — 모델 필요)

let pdfLibPromise = null;

/** pdf-lib 을 필요한 순간에만 불러온다(초기 번들에 포함되지 않도록) */
export function loadPdfLib() {
  if (!pdfLibPromise) pdfLibPromise = import("pdf-lib");
  return pdfLibPromise;
}

/** File → Uint8Array */
export function readFileBytes(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} 을 읽지 못했습니다.`));
    reader.readAsArrayBuffer(file);
  });
}

/** 문서 기본 정보 */
export async function inspectPdf(file) {
  const { PDFDocument } = await loadPdfLib();
  const bytes = await readFileBytes(file);
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = doc.getPages();
    return {
      ok: true, name: file.name, size: file.size,
      pageCount: pages.length,
      pageSizes: pages.map((p) => {
        const { width, height } = p.getSize();
        return { width: Math.round(width), height: Math.round(height), landscape: width > height };
      }),
      meta: {
        title: doc.getTitle() || "", author: doc.getAuthor() || "",
        subject: doc.getSubject() || "", keywords: doc.getKeywords() || "",
        creator: doc.getCreator() || "", producer: doc.getProducer() || "",
        creationDate: safeDate(doc.getCreationDate()), modificationDate: safeDate(doc.getModificationDate()),
      },
      encrypted: doc.isEncrypted,
    };
  } catch (e) {
    return { ok: false, name: file.name, reason: `PDF 를 열지 못했습니다: ${e.message}` };
  }
}

function safeDate(d) {
  try { return d ? d.toISOString().slice(0, 19).replace("T", " ") : ""; } catch { return ""; }
}

/** 여러 PDF 를 순서대로 합친다 */
export async function mergePdfs(files) {
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();
  let total = 0;
  for (const file of files) {
    const bytes = await readFileBytes(file);
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    total += pages.length;
  }
  return { bytes: await out.save(), pageCount: total };
}

/**
 * "1-3, 5, 8-" 같은 페이지 범위 문자열을 0-기반 인덱스 배열로.
 * 잘못된 범위는 무시하고 유효한 것만 남긴다.
 */
export function parsePageRange(spec, pageCount) {
  const s = String(spec ?? "").trim();
  if (!s) return [];
  const out = [];
  for (const part of s.split(",")) {
    const t = part.trim();
    if (!t) continue;
    const m = /^(\d+)?\s*-\s*(\d+)?$/.exec(t);
    if (m) {
      const from = m[1] ? Number(m[1]) : 1;
      const to = m[2] ? Number(m[2]) : pageCount;
      for (let i = from; i <= Math.min(to, pageCount); i++) if (i >= 1) out.push(i - 1);
    } else if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (n >= 1 && n <= pageCount) out.push(n - 1);
    }
  }
  return [...new Set(out)];
}

/** 선택한 페이지만 뽑아 새 PDF 로 */
export async function extractPages(file, indices) {
  const { PDFDocument } = await loadPdfLib();
  const src = await PDFDocument.load(await readFileBytes(file), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return { bytes: await out.save(), pageCount: pages.length };
}

/** 페이지 단위로 쪼갠다 — everyN 장씩 묶어 여러 파일로 */
export async function splitPdf(file, { everyN = 1 } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const src = await PDFDocument.load(await readFileBytes(file), { ignoreEncryption: true });
  const total = src.getPageCount();
  const chunks = [];
  const n = Math.max(1, Math.floor(everyN));

  for (let start = 0; start < total; start += n) {
    const indices = [];
    for (let i = start; i < Math.min(start + n, total); i++) indices.push(i);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    chunks.push({
      bytes: await out.save(),
      label: indices.length === 1 ? `${indices[0] + 1}쪽` : `${indices[0] + 1}-${indices[indices.length - 1] + 1}쪽`,
      pageCount: indices.length,
    });
  }
  return chunks;
}

/** 이미지 여러 장 → PDF 한 권 */
export async function imagesToPdf(files, { pageSize = "fit", margin = 0 } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const A4 = [595.28, 841.89];

  for (const file of files) {
    const bytes = await readFileBytes(file);
    const isPng = /\.png$/i.test(file.name) || file.type === "image/png";
    let embedded;
    try {
      embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch {
      // 확장자와 실제 형식이 다를 수 있어 반대로 한 번 더 시도
      try { embedded = isPng ? await doc.embedJpg(bytes) : await doc.embedPng(bytes); }
      catch { continue; } // WebP 등 지원하지 않는 형식은 건너뛴다
    }

    if (pageSize === "a4") {
      const page = doc.addPage(A4);
      const maxW = A4[0] - margin * 2;
      const maxH = A4[1] - margin * 2;
      const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      page.drawImage(embedded, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
    } else {
      const page = doc.addPage([embedded.width + margin * 2, embedded.height + margin * 2]);
      page.drawImage(embedded, { x: margin, y: margin, width: embedded.width, height: embedded.height });
    }
  }

  if (!doc.getPageCount()) return { ok: false, reason: "PDF 로 넣을 수 있는 이미지가 없습니다. JPG·PNG 만 지원합니다." };
  return { ok: true, bytes: await doc.save(), pageCount: doc.getPageCount() };
}

/** 메타데이터 보기/지우기 — 이력서에 남은 작성자·회사명 유출을 막는다 */
export async function stripMetadata(file, { keep = {} } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.load(await readFileBytes(file), { ignoreEncryption: true });

  const before = {
    title: doc.getTitle() || "", author: doc.getAuthor() || "", subject: doc.getSubject() || "",
    keywords: doc.getKeywords() || "", creator: doc.getCreator() || "", producer: doc.getProducer() || "",
  };

  doc.setTitle(keep.title || "");
  doc.setAuthor(keep.author || "");
  doc.setSubject(keep.subject || "");
  doc.setKeywords(keep.keywords ? [keep.keywords] : []);
  doc.setCreator(keep.creator || "");
  doc.setProducer(keep.producer || "");

  return { bytes: await doc.save(), removed: Object.entries(before).filter(([, v]) => v).map(([k, v]) => ({ key: k, value: v })) };
}

export const PDF_PAGE_PRESETS = [
  { key: "fit", label: "이미지 크기에 맞춤" },
  { key: "a4", label: "A4 (가운데 정렬)" },
];

/**
 * 예시 PDF 를 그 자리에서 만든다.
 *
 * <p>미리 만들어 둔 파일을 두고 읽어오는 방법은 못 쓴다 — CSP 의 {@code connect-src 'none'} 이
 * fetch 를 막기 때문이다(그게 "입력이 서버로 안 간다" 를 브라우저가 보증하게 하는 장치다).
 * 어차피 pdf-lib 이 이 화면에 이미 올라와 있으니 만들어 쓰는 편이 파일도 안 늘고 정확하다.
 *
 * @param name 파일 이름
 * @param pageCount 만들 쪽 수
 * @returns {Promise<File>}
 */
export async function makeSamplePdf(name, pageCount = 3) {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const title = name.replace(/\.pdf$/i, "");

  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([595.28, 841.89]); // A4
    page.drawText(title, { x: 60, y: 740, size: 28, font, color: rgb(0.17, 0.15, 0.27) });
    page.drawText(`page ${i} / ${pageCount}`, { x: 60, y: 700, size: 14, font, color: rgb(0.43, 0.4, 0.6) });
    page.drawRectangle({ x: 60, y: 120, width: 475, height: 550, borderWidth: 1, borderColor: rgb(0.85, 0.84, 0.92) });
    page.drawText("sample document", { x: 80, y: 640, size: 12, font, color: rgb(0.6, 0.58, 0.72) });
  }
  const bytes = await doc.save();
  return new File([bytes], name, { type: "application/pdf" });
}
