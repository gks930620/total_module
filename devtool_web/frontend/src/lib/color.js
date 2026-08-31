// 색상 변환 + WCAG 대비 계산 — 전부 클라이언트(NFR-02).

const NAMED = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", lime: "#00ff00",
  blue: "#0000ff", yellow: "#ffff00", cyan: "#00ffff", aqua: "#00ffff", magenta: "#ff00ff",
  fuchsia: "#ff00ff", gray: "#808080", grey: "#808080", silver: "#c0c0c0", maroon: "#800000",
  olive: "#808000", navy: "#000080", teal: "#008080", purple: "#800080", orange: "#ffa500",
  pink: "#ffc0cb", brown: "#a52a2a", gold: "#ffd700", indigo: "#4b0082", violet: "#ee82ee",
  transparent: "#00000000",
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v };
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const toChannel = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(toChannel(hh + 1 / 3) * 255),
    g: Math.round(toChannel(hh) * 255),
    b: Math.round(toChannel(hh - 1 / 3) * 255),
  };
}

/** 문자열 → { ok, r, g, b, a }. hex(3/4/6/8), rgb(), rgba(), hsl(), hsla(), 색 이름 지원. */
export function parseColor(input) {
  let s = String(input ?? "").trim().toLowerCase();
  if (!s) return { ok: false, reason: "색상 값을 입력해 주세요." };

  if (NAMED[s]) s = NAMED[s];
  if (!s.startsWith("#") && /^[0-9a-f]{3,8}$/.test(s)) s = `#${s}`;

  if (s.startsWith("#")) {
    const h = s.slice(1);
    let full;
    if (h.length === 3 || h.length === 4) {
      full = h.split("").map((c) => c + c).join("");
    } else if (h.length === 6 || h.length === 8) {
      full = h;
    } else {
      return { ok: false, reason: "hex 는 3·4·6·8자리여야 합니다." };
    }
    if (!/^[0-9a-f]+$/.test(full)) return { ok: false, reason: "hex 에 잘못된 문자가 있습니다." };
    return {
      ok: true,
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgbM = /^rgba?\(([^)]+)\)$/.exec(s);
  if (rgbM) {
    const parts = rgbM[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3) return { ok: false, reason: "rgb() 인자가 부족합니다." };
    const num = (p) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p));
    return {
      ok: true,
      r: clamp(Math.round(num(parts[0])), 0, 255),
      g: clamp(Math.round(num(parts[1])), 0, 255),
      b: clamp(Math.round(num(parts[2])), 0, 255),
      a: parts[3] !== undefined ? clamp(parseFloat(parts[3]), 0, 1) : 1,
    };
  }

  const hslM = /^hsla?\(([^)]+)\)$/.exec(s);
  if (hslM) {
    const parts = hslM[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3) return { ok: false, reason: "hsl() 인자가 부족합니다." };
    const rgb = hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
    return { ok: true, ...rgb, a: parts[3] !== undefined ? clamp(parseFloat(parts[3]), 0, 1) : 1 };
  }

  return { ok: false, reason: "hex · rgb() · hsl() · 색 이름 중 하나로 입력해 주세요." };
}

const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");

/** #rrggbb (알파가 1 미만이면 #rrggbbaa) */
export function toHex(c) {
  if (!c || !c.ok) return "";
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  return c.a < 1 ? `${base}${hex2(c.a * 255)}` : base;
}

export function toRgbString(c) {
  if (!c || !c.ok) return "";
  return c.a < 1
    ? `rgba(${c.r}, ${c.g}, ${c.b}, ${Number(c.a.toFixed(3))})`
    : `rgb(${c.r}, ${c.g}, ${c.b})`;
}

/** { h, s, l } (h: 0-360, s/l: 0-100) */
export function toHsl(c) {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function toHslString(c) {
  if (!c || !c.ok) return "";
  const { h, s, l } = toHsl(c);
  return c.a < 1
    ? `hsla(${h}, ${s}%, ${l}%, ${Number(c.a.toFixed(3))})`
    : `hsl(${h}, ${s}%, ${l}%)`;
}

/** { h, s, v } — 디자인 툴에서 쓰는 HSV */
export function toHsv(c) {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round((max === 0 ? 0 : d / max) * 100), v: Math.round(max * 100) };
}

// WCAG 2.1 상대 휘도
function channelLum(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(c) {
  if (!c || !c.ok) return 0;
  return 0.2126 * channelLum(c.r) + 0.7152 * channelLum(c.g) + 0.0722 * channelLum(c.b);
}

/** 두 색의 명암비 (1~21) */
export function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 등급 — 본문 텍스트 기준 */
export function wcagLevel(ratio) {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA(큰 글씨)";
  return "실패";
}

/**
 * 명암비 값 하나를 "그래서 어떻게 하라는 건지" 한 줄로 바꾼다.
 *
 * <p>{@link wcagLevel} 은 등급 이름(AA·실패)만 준다. 이름만 봐서는 얼마나 모자란지,
 * 무엇을 고쳐야 하는지 알 수 없어서 화면에 함께 띄울 문장을 따로 만든다.
 * 기준은 WCAG 2.1 — 본문 4.5:1, 큰 글씨(굵은 19px 이상) 3:1, AAA 7:1.
 */
export function contrastAdvice(ratio) {
  if (ratio >= 7) return "본문·큰 글씨 모두 넉넉히 통과합니다.";
  if (ratio >= 4.5) return "본문에 써도 됩니다. 7 이상이면 AAA 입니다.";
  if (ratio >= 3) return "큰 글씨(굵은 19px 이상)에만 쓸 수 있습니다. 본문에 쓰려면 4.5 이상으로 올리세요.";
  return "어디에도 쓰기 어렵습니다. 글자색을 더 진하게 하거나 배경을 더 밝게 하세요.";
}
