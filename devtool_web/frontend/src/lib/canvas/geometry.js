// 그리기 편집기의 도형·간선 기하 — 화면과 내보내기가 **같은 그림**을 쓰기 위한 공통층.
//
// 노드를 어떻게 그릴지는 여기서 "원시 도형 목록" 으로만 정한다. 화면(React)은 이걸 CSS 토큰
// 색으로, 내보내기(exportSvg)는 실제 색으로 칠한다. 두 렌더러가 그리기 로직을 각자 들고 있으면
// 반드시 어긋난다 — 화면에서 본 것과 저장된 파일이 다르면 편집기를 믿을 수 없다.
//
// 원시 도형: { t: "rect"|"ellipse"|"path"|"circle"|"line"|"text", ...좌표, fill, stroke, ... }
// 색은 실제 값이 아니라 **역할 이름**이다: surface·soft·accent·border·strong·text·muted·onAccent

import { nodeSize } from "./model.js";

// ── 노드 → 원시 도형 목록 ──────────────────────────────────────────

export function shapePrimitives(node) {
  const { w, h } = nodeSize(node);
  const { x, y } = node;

  switch (node.kind) {
    case "table": {
      const prims = [
        { t: "rect", x, y, w, h, rx: 10, fill: "surface", stroke: "border" },
        { t: "rect", x, y, w, h: 30, rx: 10, fill: "accent", stroke: "none" },
        { t: "rect", x, y: y + 20, w, h: 10, fill: "accent", stroke: "none" },   // 머리 아래 모서리 각지게
        { t: "text", x: x + w / 2, y: y + 20, text: node.name || "테이블", anchor: "middle", bold: true, fill: "onAccent", size: 13 },
      ];
      (node.fields ?? []).forEach((f, i) => {
        const ty = y + 34 + i * 22 + 15;
        const marks = [f.pk && "PK", f.fk && "FK", f.unique && !f.pk && "UQ"].filter(Boolean).join(" ");
        prims.push({ t: "text", x: x + 12, y: ty, text: f.name, fill: f.pk ? "accentText" : "text", bold: !!f.pk, size: 12, mono: true });
        prims.push({ t: "text", x: x + w - 12, y: ty, text: `${f.type}${marks ? ` ${marks}` : ""}`, anchor: "end", fill: "muted", size: 11, mono: true });
      });
      if (!(node.fields ?? []).length) {
        prims.push({ t: "text", x: x + w / 2, y: y + 34 + 15, text: "(필드 없음)", anchor: "middle", fill: "muted", size: 11 });
      }
      return prims;
    }

    case "class": {
      const prims = [
        { t: "rect", x, y, w, h, rx: 10, fill: "surface", stroke: "border" },
        { t: "text", x: x + w / 2, y: y + 20, text: node.name || "Class", anchor: "middle", bold: true, fill: "text", size: 13 },
        { t: "line", x1: x, y1: y + 30, x2: x + w, y2: y + 30, stroke: "border" },
      ];
      let ty = y + 30;
      if (node.stereo && node.stereo !== "class") {
        ty += 18;
        prims.push({ t: "text", x: x + w / 2, y: ty - 4, text: `«${node.stereo}»`, anchor: "middle", fill: "muted", size: 11 });
      }
      for (const f of node.fields ?? []) {
        ty += 20;
        prims.push({ t: "text", x: x + 12, y: ty - 5, text: f, fill: "text", size: 12, mono: true });
      }
      if (node.methods?.length) {
        ty += 6;
        prims.push({ t: "line", x1: x, y1: ty - 3, x2: x + w, y2: ty - 3, stroke: "border" });
        for (const m of node.methods) {
          ty += 20;
          prims.push({ t: "text", x: x + 12, y: ty - 5, text: m, fill: "text", size: 12, mono: true });
        }
      }
      return prims;
    }

    case "decision": {
      const cx = x + w / 2, cy = y + h / 2;
      return [
        { t: "path", d: `M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} L ${x} ${cy} Z`, fill: "surface", stroke: "border" },
        { t: "text", x: cx, y: cy + 4, text: node.label || "조건?", anchor: "middle", fill: "text", size: 12 },
      ];
    }

    case "db": {
      const ry = 9;
      return [
        { t: "path", d: `M ${x} ${y + ry} A ${w / 2} ${ry} 0 0 1 ${x + w} ${y + ry} V ${y + h - ry} A ${w / 2} ${ry} 0 0 1 ${x} ${y + h - ry} Z`, fill: "surface", stroke: "border" },
        { t: "path", d: `M ${x} ${y + ry} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y + ry}`, fill: "none", stroke: "border" },
        { t: "text", x: x + w / 2, y: y + h / 2 + 8, text: node.label || "DB", anchor: "middle", fill: "text", size: 12 },
      ];
    }

    case "start":
    case "end":
      return [
        { t: "rect", x, y, w, h, rx: h / 2, fill: node.kind === "start" ? "accent" : "surface", stroke: node.kind === "start" ? "none" : "strong" },
        { t: "text", x: x + w / 2, y: y + h / 2 + 4, text: node.label || (node.kind === "start" ? "시작" : "끝"), anchor: "middle", bold: true, fill: node.kind === "start" ? "onAccent" : "text", size: 12 },
      ];

    case "initial":
      return [{ t: "circle", cx: x + w / 2, cy: y + h / 2, r: 9, fill: "strong", stroke: "none" }];

    case "final":
      return [
        { t: "circle", cx: x + w / 2, cy: y + h / 2, r: 11, fill: "none", stroke: "strong" },
        { t: "circle", cx: x + w / 2, cy: y + h / 2, r: 6, fill: "strong", stroke: "none" },
      ];

    default: // step · state
      return [
        { t: "rect", x, y, w, h, rx: node.kind === "state" ? 14 : 8, fill: "surface", stroke: "border" },
        { t: "text", x: x + w / 2, y: y + h / 2 + 4, text: node.label || "이름", anchor: "middle", fill: "text", size: 12 },
      ];
  }
}

// ── 간선 기하 ──────────────────────────────────────────────────────

/** 상자 중심에서 target 방향으로 나가는 경계점 */
function anchor(node, tx, ty) {
  const { w, h } = nodeSize(node);
  const cx = node.x + w / 2, cy = node.y + h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? (w / 2) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (h / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

const center = (n) => {
  const { w, h } = nodeSize(n);
  return { x: n.x + w / 2, y: n.y + h / 2 };
};

/**
 * 간선의 선·화살촉·라벨 위치.
 * @returns {{path, arrow:[..3점], mx, my, x1,y1,x2,y2, self:boolean, dashed:boolean, hollow:boolean}}
 */
export function edgeGeometry(doc, edge, nodesById) {
  const a = nodesById.get(edge.from);
  const b = nodesById.get(edge.to);
  const dashed = edge.kind === "implements" || edge.kind === "reply";
  const hollow = edge.kind === "extends" || edge.kind === "implements";

  if (edge.from === edge.to) {
    // 자기 전이 — 오른쪽 위에 고리를 건다
    const { w } = nodeSize(a);
    const x = a.x + w, y = a.y + 10;
    const path = `M ${x - 14} ${y} C ${x + 34} ${y - 30}, ${x + 34} ${y + 40}, ${x - 2} ${y + 26}`;
    return { path, arrow: arrowAt(x - 2, y + 26, Math.PI * 0.85, hollow), mx: x + 28, my: y - 2, x1: x, y1: y, x2: x, y2: y + 26, self: true, dashed, hollow };
  }

  const ca = center(a), cb = center(b);
  const p1 = anchor(a, cb.x, cb.y);
  const p2 = anchor(b, ca.x, ca.y);
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  return {
    path: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
    arrow: arrowAt(p2.x, p2.y, angle, hollow),
    mx: (p1.x + p2.x) / 2,
    my: (p1.y + p2.y) / 2,
    x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
    self: false, dashed, hollow,
  };
}

/** 화살촉 삼각형 세 점 — hollow(상속)는 조금 크게 */
function arrowAt(x, y, angle, hollow) {
  const len = hollow ? 14 : 10;
  const spread = hollow ? 0.5 : 0.42;
  const p = (da) => [x - len * Math.cos(angle + da), y - len * Math.sin(angle + da)];
  return [[x, y], p(spread), p(-spread)];
}
