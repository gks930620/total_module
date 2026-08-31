// diagram — 화면은 components/DiagramTool.jsx 하나를 함께 쓴다.
// 종류마다 페이지를 따로 두는 이유는 검색이다("ERD 그리기" 와 "시퀀스 다이어그램" 은 다른 검색어).
import { DiagramTool } from "../components/DiagramTool.jsx";
import { getToolBySlug } from "../lib/tools.js";

const tool = getToolBySlug("diagram");

const GUIDE = {
  intro: "앞의 다섯 가지 말고도 간트 차트·마인드맵·사용자 여정·깃 브랜치·파이 차트·타임라인 등 20여 종을 그립니다. 위쪽 '예시 넣기' 에서 종류를 고른 뒤 한 줄씩 고쳐 쓰는 것이 가장 빠릅니다.",
  screen: {
    layout: "split",
    left: { head: "다이어그램 문법", body: "예시에서 종류를 고르고 고치기" },
    right: { head: "미리보기", body: "확대·축소 · SVG 저장 · PNG 저장" },
    caption: "첫 줄이 종류를 정하고 그 아래가 내용입니다.",
  },
  example: {
    in: `pie title 브라우저 점유율
  "크롬" : 65
  "사파리" : 19
  "엣지" : 5`,
    out: `원 그래프 — 크롬 65 · 사파리 19 · 엣지 5
비율이 조각 크기와 범례로 함께 나옵니다`,
    outLabel: "나오는 그림",
  },
  notes: [
    "간트(일정) · 마인드맵 · 사용자 여정 · 깃 브랜치 흐름 · 파이 차트 · 타임라인 · 우선순위 사분면 · C4 구성도 · 요구사항 추적 · XY 차트 등을 그립니다.",
    "문법은 예시를 넣고 고쳐 보는 게 가장 빠릅니다. 틀리면 몇 번째 줄이 문제인지 한국어로 알려 줍니다.",
    "이름 자리에 한글을 못 쓰는 종류가 있습니다(요구사항 추적의 requirement 이름, XY 차트의 축 항목). 그럴 때는 따옴표로 감싸면 됩니다. 라벨·설명 자리에는 대부분 그냥 써도 됩니다.",
    "SVG 는 확대해도 안 깨지고 PNG 는 어디에나 붙습니다. '문법 복사' 로 가져간 텍스트는 GitHub·Notion·Obsidian 에 그대로 붙여도 그려집니다 — 같은 문법입니다.",
  ],
};

export function DiagramPage() {
  return (
    <DiagramTool
      tool={tool}
      type="free"
      guide={GUIDE}
      intro="앞의 다섯 가지 말고도 간트 차트·마인드맵·사용자 여정·깃 브랜치 등 20여 종을 그립니다."
    />
  );
}
