// 그린 문서 → SVG 파일 문자열.
//
// 화면은 CSS 토큰으로 칠하지만 **파일은 이 사이트 밖에서 열린다** — 문서에 붙이고,
// 노션에 올리고, 남에게 보낸다. 그래서 실제 색을 박아 자기완결로 만든다.
// 도형 기하는 geometry.js 와 공유하므로 화면에서 본 그대로 나간다.

import { nodeSize } from "./model.js";
import { shapePrimitives, edgeGeometry } from "./geometry.js";

/** 밝은 배경 기준 실색 — styles.css 의 라이트 토큰에서 가져온 값 */
const COLOR = {
  surface: "#ffffff",
  soft: "#f5f4ff",
  accent: "#6d5efc",
  accentText: "#5a49f0",
  onAccent: "#ffffff",
  border: "#c9c6e4",
  strong: "#63608a",
  text: "#2b2745",
  muted: "#63608a",
  none: "none",
};

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT = "system-ui, 'Malgun Gothic', sans-serif";
const MONO = "ui-monospace, Consolas, monospace";

function primToSvg(p) {
  const fill = COLOR[p.fill ?? "none"] ?? COLOR.none;
  const stroke = COLOR[p.stroke ?? "none"] ?? COLOR.none;
  const sw = stroke === "none" ? "" : ' stroke-width="1.5"';
  switch (p.t) {
    case "rect":
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx ?? 0}" fill="${fill}" stroke="${stroke}"${sw}/>`;
    case "circle":
      return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${fill}" stroke="${stroke}"${sw}/>`;
    case "line":
      return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${stroke}"${sw}/>`;
    case "path":
      return `<path d="${p.d}" fill="${fill}" stroke="${stroke}"${sw}/>`;
    case "text":
      return `<text x="${p.x}" y="${p.y}" font-family="${p.mono ? MONO : FONT}" font-size="${p.size ?? 12}"` +
        `${p.bold ? ' font-weight="700"' : ""}${p.anchor ? ` text-anchor="${p.anchor}"` : ""} fill="${COLOR[p.fill ?? "text"]}">${esc(p.text)}</text>`;
    default:
      return "";
  }
}

function edgeToSvg(doc, edge, nodesById) {
  const g = edgeGeometry(doc, edge, nodesById);
  const parts = [
    `<path d="${g.path}" fill="none" stroke="${COLOR.strong}" stroke-width="1.5"${g.dashed ? ' stroke-dasharray="6 5"' : ""}/>`,
    `<polygon points="${g.arrow.map((p) => p.join(",")).join(" ")}" fill="${g.hollow ? COLOR.surface : COLOR.strong}" stroke="${COLOR.strong}" stroke-width="1.5"/>`,
  ];
  const halo = (x, y, text, size = 11) =>
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" text-anchor="middle" stroke="${COLOR.surface}" stroke-width="4" paint-order="stroke" fill="${COLOR.muted}">${esc(text)}</text>`;
  if (edge.label) parts.push(halo(g.mx, g.my - 5, edge.label));
  if (doc.type === "er") {
    if (edge.fromCard) parts.push(halo(g.x1 + (g.x2 - g.x1) * 0.12, g.y1 + (g.y2 - g.y1) * 0.12 - 4, edge.fromCard));
    if (edge.toCard) parts.push(halo(g.x1 + (g.x2 - g.x1) * 0.88, g.y1 + (g.y2 - g.y1) * 0.88 - 4, edge.toCard));
  }
  return parts.join("");
}

/** 문서 전체를 SVG 문자열로. 여백을 두고 내용에 맞춰 크기를 잡는다. */
export function toSvgString(doc) {
  const PAD = 24;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of doc.nodes) {
    const { w, h } = nodeSize(n);
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
  }
  if (!doc.nodes.length) { minX = 0; minY = 0; maxX = 200; maxY = 120; }

  const w = Math.ceil(maxX - minX + PAD * 2);
  const h = Math.ceil(maxY - minY + PAD * 2);
  const nodesById = new Map(doc.nodes.map((n) => [n.id, n]));

  const body = [
    ...doc.edges.map((e) => edgeToSvg(doc, e, nodesById)),
    ...doc.nodes.flatMap((n) => shapePrimitives(n).map(primToSvg)),
  ].join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - PAD} ${minY - PAD} ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}">
  <rect x="${minX - PAD}" y="${minY - PAD}" width="${w}" height="${h}" fill="#ffffff"/>
  ${body}
</svg>`;
}
