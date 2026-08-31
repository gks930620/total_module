// 이미지 처리 — 전부 Canvas API. 파일이 브라우저 밖으로 나가지 않는다(NFR-02).
//
// 경쟁 사이트는 대부분 서버 업로드 방식이라, "안 올라간다"가 이 도구군의 핵심 가치다.
// 순수 계산이 아니라 브라우저 API(Canvas·Image·FileReader) 의존이라 단위 테스트 대상이
// 아니다 — 대신 순수 함수(계산·EXIF 파싱)는 분리해 테스트한다.

// ── 순수 계산부 (테스트 대상) ──────────────────────────────

/** 원본 크기 → 목표 크기. mode: "fit"(비율 유지 축소) | "exact" | "width" | "height" | "percent" */
export function computeSize({ width, height, mode = "fit", targetWidth, targetHeight, percent, allowUpscale = false }) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0 && h > 0)) return { ok: false, reason: "원본 크기를 알 수 없습니다." };

  let outW = w;
  let outH = h;

  if (mode === "percent") {
    const p = Math.max(1, Math.min(Number(percent) || 100, 500)) / 100;
    outW = Math.round(w * p);
    outH = Math.round(h * p);
  } else if (mode === "width") {
    const tw = Number(targetWidth);
    if (!(tw > 0)) return { ok: false, reason: "가로 크기를 입력해 주세요." };
    outW = Math.round(tw);
    outH = Math.round((tw * h) / w);
  } else if (mode === "height") {
    const th = Number(targetHeight);
    if (!(th > 0)) return { ok: false, reason: "세로 크기를 입력해 주세요." };
    outH = Math.round(th);
    outW = Math.round((th * w) / h);
  } else if (mode === "exact") {
    const tw = Number(targetWidth);
    const th = Number(targetHeight);
    if (!(tw > 0 && th > 0)) return { ok: false, reason: "가로·세로를 모두 입력해 주세요." };
    outW = Math.round(tw);
    outH = Math.round(th);
  } else {
    // fit — 지정한 상자 안에 비율 유지로 넣는다
    const tw = Number(targetWidth) || w;
    const th = Number(targetHeight) || h;
    const scale = Math.min(tw / w, th / h);
    const s = allowUpscale ? scale : Math.min(scale, 1);
    outW = Math.max(1, Math.round(w * s));
    outH = Math.max(1, Math.round(h * s));
  }

  if (!allowUpscale && mode !== "exact" && mode !== "percent" && (outW > w || outH > h)) {
    outW = w; outH = h;
  }
  return {
    ok: true,
    width: Math.max(1, outW), height: Math.max(1, outH),
    scale: Number((outW / w).toFixed(4)),
    upscaled: outW > w || outH > h,
  };
}

export const IMAGE_FORMATS = [
  { key: "image/jpeg", label: "JPG", ext: "jpg", quality: true, note: "사진에 적합. 투명도 없음" },
  { key: "image/png", label: "PNG", ext: "png", quality: false, note: "투명도 유지. 용량 큼" },
  { key: "image/webp", label: "WebP", ext: "webp", quality: true, note: "같은 화질에 용량 30% 작음" },
];

/** 증명사진 규격(mm) — 300dpi 기준 픽셀도 함께 */
export const PHOTO_SPECS = [
  { key: "passport", label: "여권 사진", mm: [35, 45] },
  { key: "idcard", label: "주민등록증·운전면허", mm: [35, 45] },
  { key: "resume", label: "이력서 (3×4)", mm: [30, 40] },
  { key: "halfcard", label: "반명함 (3×4)", mm: [30, 40] },
  { key: "visa_us", label: "미국 비자 (2×2인치)", mm: [51, 51] },
];
export function mmToPx(mm, dpi = 300) {
  return Math.round((mm / 25.4) * dpi);
}

// ── EXIF 파싱 (순수 함수, 테스트 대상) ─────────────────────

const EXIF_TAGS = {
  0x010f: "제조사", 0x0110: "모델", 0x0112: "회전(Orientation)",
  0x0132: "촬영일시", 0x829a: "노출시간", 0x829d: "조리개(F)",
  0x8827: "ISO", 0x920a: "초점거리", 0x9003: "원본 촬영일시",
  0x0131: "소프트웨어", 0x013b: "작성자",
};
const GPS_TAGS = { 0x0001: "위도 방향", 0x0002: "위도", 0x0003: "경도 방향", 0x0004: "경도" };

/**
 * JPEG 바이트에서 EXIF 를 읽는다. GPS(촬영 위치)를 찾아내는 게 주 목적이다.
 * @param bytes Uint8Array
 */
export function readExif(bytes) {
  if (!bytes || bytes.length < 4) return { ok: false, reason: "파일을 읽을 수 없습니다." };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0) !== 0xffd8) {
    return { ok: true, hasExif: false, note: "JPEG 가 아닙니다. PNG·WebP 에는 보통 EXIF 가 없습니다.", tags: [], gps: null };
  }

  let offset = 2;
  while (offset < view.byteLength - 4) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      // APP1 — "Exif\0\0" 확인
      const head = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (head === "Exif") return parseTiff(view, offset + 10);
      break;
    }
    if (marker === 0xda) break; // 이미지 데이터 시작
    offset += 2 + size;
  }
  return { ok: true, hasExif: false, tags: [], gps: null };
}

function parseTiff(view, start) {
  const le = view.getUint16(start) === 0x4949; // "II" = little endian
  const get16 = (o) => view.getUint16(o, le);
  const get32 = (o) => view.getUint32(o, le);
  if (get16(start + 2) !== 0x002a) return { ok: true, hasExif: false, tags: [], gps: null };

  const tags = [];
  let gps = null;

  const readIfd = (ifdStart, dict, collector) => {
    const count = get16(ifdStart);
    for (let i = 0; i < count; i++) {
      const entry = ifdStart + 2 + i * 12;
      const tag = get16(entry);
      const type = get16(entry + 2);
      const num = get32(entry + 4);
      const valueOffset = entry + 8;

      if (tag === 0x8769) { readIfd(start + get32(valueOffset), EXIF_TAGS, collector); continue; }
      if (tag === 0x8825) { gps = readGps(start + get32(valueOffset)); continue; }

      const label = dict[tag];
      if (!label) continue;
      collector.push({ tag, label, value: readValue(view, start, valueOffset, type, num, le) });
    }
  };

  const readGps = (gpsStart) => {
    const g = {};
    const count = get16(gpsStart);
    for (let i = 0; i < count; i++) {
      const entry = gpsStart + 2 + i * 12;
      const tag = get16(entry);
      const type = get16(entry + 2);
      const num = get32(entry + 4);
      if (GPS_TAGS[tag]) g[tag] = readValue(view, start, entry + 8, type, num, le);
    }
    const lat = toDegrees(g[0x0002], g[0x0001]);
    const lon = toDegrees(g[0x0004], g[0x0003]);
    return lat !== null && lon !== null ? { latitude: lat, longitude: lon } : null;
  };

  readIfd(start + get32(start + 4), EXIF_TAGS, tags);
  return { ok: true, hasExif: tags.length > 0 || gps !== null, tags, gps };
}

function readValue(view, tiffStart, valueOffset, type, num, le) {
  const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const size = (sizes[type] || 1) * num;
  const at = size > 4 ? tiffStart + view.getUint32(valueOffset, le) : valueOffset;
  try {
    if (type === 2) {
      let s = "";
      for (let i = 0; i < num - 1; i++) s += String.fromCharCode(view.getUint8(at + i));
      return s.trim();
    }
    if (type === 3) return view.getUint16(at, le);
    if (type === 4) return view.getUint32(at, le);
    if (type === 5 || type === 10) {
      const values = [];
      for (let i = 0; i < num; i++) {
        const n = view.getUint32(at + i * 8, le);
        const d = view.getUint32(at + i * 8 + 4, le);
        values.push(d === 0 ? 0 : n / d);
      }
      return values.length === 1 ? values[0] : values;
    }
    return view.getUint8(at);
  } catch {
    return null;
  }
}

function toDegrees(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const deg = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ref === "S" || ref === "W" ? -deg : deg;
}

// ── Canvas 작업부 (브라우저 전용) ──────────────────────────

/** File → HTMLImageElement */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 읽을 수 없습니다.")); };
    img.src = url;
  });
}

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function canvasToBlob(canvas, type = "image/jpeg", quality = 0.85) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * 리사이즈 + 회전/반전 + 포맷 변환을 한 번에.
 * Canvas 로 다시 그리는 순간 EXIF 는 사라진다 — 그래서 이 도구를 거치면 위치정보도 함께 제거된다.
 */
export async function transformImage(img, {
  width, height, rotate = 0, flipH = false, flipV = false,
  type = "image/jpeg", quality = 0.85, background = "#ffffff",
  crop = null, // { x, y, w, h } — 원본 픽셀 기준
}) {
  const src = crop || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const swap = rotate === 90 || rotate === 270;
  const outW = swap ? height : width;
  const outH = swap ? width : height;

  const canvas = canvasOf(outW, outH);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";

  // JPG 는 투명도를 지원하지 않아 검게 나온다 → 배경을 먼저 칠한다
  if (type === "image/jpeg") {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.translate(outW / 2, outH / 2);
  if (rotate) ctx.rotate((rotate * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(src === crop ? img : img, src.x, src.y, src.w, src.h, -width / 2, -height / 2, width, height);

  const blob = await canvasToBlob(canvas, type, quality);
  return { blob, canvas, width: outW, height: outH };
}

/** 여러 장을 세로/가로로 이어붙인다 */
export async function mergeImages(images, {
  direction = "vertical", align = "center", gap = 0,
  background = "#ffffff", type = "image/png", quality = 0.92, unify = "none", // "none" | "width" | "height"
}) {
  if (!images.length) return null;

  const sizes = images.map((img) => ({ w: img.naturalWidth, h: img.naturalHeight }));
  let scaled = sizes;

  if (unify === "width") {
    const target = Math.min(...sizes.map((s) => s.w));
    scaled = sizes.map((s) => ({ w: target, h: Math.round((s.h * target) / s.w) }));
  } else if (unify === "height") {
    const target = Math.min(...sizes.map((s) => s.h));
    scaled = sizes.map((s) => ({ w: Math.round((s.w * target) / s.h), h: target }));
  }

  const vertical = direction === "vertical";
  const totalGap = gap * (images.length - 1);
  const canvasW = vertical ? Math.max(...scaled.map((s) => s.w)) : scaled.reduce((a, s) => a + s.w, 0) + totalGap;
  const canvasH = vertical ? scaled.reduce((a, s) => a + s.h, 0) + totalGap : Math.max(...scaled.map((s) => s.h));

  const canvas = canvasOf(canvasW, canvasH);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvasW, canvasH);

  let cursor = 0;
  images.forEach((img, i) => {
    const { w, h } = scaled[i];
    let x;
    let y;
    if (vertical) {
      y = cursor;
      x = align === "start" ? 0 : align === "end" ? canvasW - w : Math.round((canvasW - w) / 2);
      cursor += h + gap;
    } else {
      x = cursor;
      y = align === "start" ? 0 : align === "end" ? canvasH - h : Math.round((canvasH - h) / 2);
      cursor += w + gap;
    }
    ctx.drawImage(img, x, y, w, h);
  });

  const blob = await canvasToBlob(canvas, type, quality);
  return { blob, canvas, width: canvasW, height: canvasH };
}

/** 지정 영역을 모자이크(픽셀화) 또는 블러 처리 */
export function applyMosaic(canvas, regions, { blockSize = 12, mode = "mosaic" } = {}) {
  const ctx = canvas.getContext("2d");
  for (const r of regions) {
    const x = Math.max(0, Math.round(r.x));
    const y = Math.max(0, Math.round(r.y));
    const w = Math.min(canvas.width - x, Math.round(r.w));
    const h = Math.min(canvas.height - y, Math.round(r.h));
    if (w <= 0 || h <= 0) continue;

    if (mode === "blackout") {
      ctx.fillStyle = "#000";
      ctx.fillRect(x, y, w, h);
      continue;
    }
    if (mode === "blur") {
      // 축소 후 확대 = 저비용 블러
      const tmp = canvasOf(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 12)));
      tmp.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, w, h);
      continue;
    }
    // mosaic — 블록 단위 평균색
    const data = ctx.getImageData(x, y, w, h);
    for (let by = 0; by < h; by += blockSize) {
      for (let bx = 0; bx < w; bx += blockSize) {
        let r0 = 0; let g0 = 0; let b0 = 0; let n = 0;
        for (let dy = 0; dy < blockSize && by + dy < h; dy++) {
          for (let dx = 0; dx < blockSize && bx + dx < w; dx++) {
            const i = ((by + dy) * w + (bx + dx)) * 4;
            r0 += data.data[i]; g0 += data.data[i + 1]; b0 += data.data[i + 2]; n++;
          }
        }
        if (!n) continue;
        ctx.fillStyle = `rgb(${Math.round(r0 / n)},${Math.round(g0 / n)},${Math.round(b0 / n)})`;
        ctx.fillRect(x + bx, y + by, Math.min(blockSize, w - bx), Math.min(blockSize, h - by));
      }
    }
  }
  return canvas;
}

/** 이미지에서 대표 색 팔레트를 뽑는다(색공간을 격자로 나눠 최빈값) */
export function extractPalette(canvas, count = 6) {
  const ctx = canvas.getContext("2d");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const buckets = new Map();
  const step = Math.max(1, Math.floor(data.length / 4 / 20000)) * 4; // 최대 2만 픽셀 표본

  for (let i = 0; i < data.length; i += step) {
    const a = data[i + 3];
    if (a < 125) continue;
    const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
    // 32단계로 양자화해 비슷한 색을 묶는다
    const key = `${r >> 5}_${g >> 5}_${b >> 5}`;
    const cur = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    cur.r += r; cur.g += g; cur.b += b; cur.n++;
    buckets.set(key, cur);
  }

  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((c) => {
      const r = Math.round(c.r / c.n);
      const g = Math.round(c.g / c.n);
      const b = Math.round(c.b / c.n);
      return {
        hex: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
        rgb: `rgb(${r}, ${g}, ${b})`,
        share: c.n,
      };
    });
}

/** 파비콘 세트 크기 */
export const FAVICON_SIZES = [16, 32, 48, 64, 128, 180, 192, 512];

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
