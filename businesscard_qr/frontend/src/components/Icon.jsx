// 인라인 SVG 아이콘. 아이콘 폰트·외부 스프라이트를 싣지 않는다 — 요청이 하나 줄고 CSP 도 단순해진다.
// 색은 currentColor 라 버튼·글자색(디자인 킷 토큰)을 그대로 따른다.
//
// 모양은 Feather Icons(https://feathericons.com)의 것을 옮겼다.
// Feather Icons — MIT License, Copyright (c) 2013-2017 Cole Bemis.

const PATHS = {
  back: [["path", { d: "M15 18l-6-6 6-6" }]],
  chevronRight: [["path", { d: "M9 18l6-6-6-6" }]],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  close: [["path", { d: "M18 6L6 18M6 6l12 12" }]],
  check: [["path", { d: "M20 6L9 17l-5-5" }]],
  more: [
    ["circle", { cx: 12, cy: 5, r: 1.5 }],
    ["circle", { cx: 12, cy: 12, r: 1.5 }],
    ["circle", { cx: 12, cy: 19, r: 1.5 }],
  ],
  sparkle: [["path", { d: "M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" }]],
  phone: [
    [
      "path",
      {
        d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
      },
    ],
  ],
  mail: [
    ["path", { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }],
    ["path", { d: "M22 6l-10 7L2 6" }],
  ],
  globe: [
    ["circle", { cx: 12, cy: 12, r: 10 }],
    ["path", { d: "M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" }],
  ],
  mapPin: [
    ["path", { d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" }],
    ["circle", { cx: 12, cy: 10, r: 3 }],
  ],
  building: [
    ["rect", { x: 4, y: 2, width: 16, height: 20, rx: 2 }],
    ["path", { d: "M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" }],
  ],
  note: [
    ["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }],
    ["path", { d: "M14 2v6h6M16 13H8M16 17H8M10 9H8" }],
  ],
  link: [
    ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
    ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }],
  ],
  copy: [
    ["rect", { x: 9, y: 9, width: 13, height: 13, rx: 2 }],
    ["path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }],
  ],
  share: [
    ["circle", { cx: 18, cy: 5, r: 3 }],
    ["circle", { cx: 6, cy: 12, r: 3 }],
    ["circle", { cx: 18, cy: 19, r: 3 }],
    ["path", { d: "M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" }],
  ],
  download: [["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" }]],
  edit: [["path", { d: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" }]],
  trash: [["path", { d: "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" }]],
  logout: [["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" }]],
  userX: [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: 8.5, cy: 7, r: 4 }],
    ["path", { d: "M18 8l5 5M23 8l-5 5" }],
  ],
  image: [
    ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ["circle", { cx: 8.5, cy: 8.5, r: 1.5 }],
    ["path", { d: "M21 15l-5-5L5 21" }],
  ],
  qr: [
    ["path", { d: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" }],
  ],
  userPlus: [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: 8.5, cy: 7, r: 4 }],
    ["path", { d: "M20 8v6M23 11h-6" }],
  ],
  file: [["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" }]],
};

export default function Icon({ name, size = 22, label }) {
  const parts = PATHS[name];
  if (!parts) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      // 이름이 없으면 장식이다 — 스크린리더가 읽지 않게 한다. 버튼의 이름은 aria-label 로 준다.
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      {parts.map(([Tag, attrs], index) => (
        <Tag key={index} {...attrs} />
      ))}
    </svg>
  );
}
