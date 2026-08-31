// flowchart — 화면은 components/DiagramTool.jsx 하나를 함께 쓴다.
// 종류마다 페이지를 따로 두는 이유는 검색이다("ERD 그리기" 와 "시퀀스 다이어그램" 은 다른 검색어).
import { DiagramTool } from "../components/DiagramTool.jsx";
import { getToolBySlug } from "../lib/tools.js";

const tool = getToolBySlug("flowchart");

const GUIDE = {
  intro: "조건과 분기가 있는 처리 흐름을 그립니다. 괄호 모양이 곧 뜻이라 [사각형]·{마름모}·([둥근])·[(원통)] 만 구분해 쓰면 되고, 첫 줄의 방향만 바꿔 세로·가로를 전환할 수 있습니다.",
  screen: {
    layout: "split",
    left: { head: "다이어그램 문법", body: "예시를 넣고 한 줄씩 고치기" },
    right: { head: "미리보기", body: "확대·축소 · SVG 저장 · PNG 저장" },
    caption: "문법이 틀리면 몇 번째 줄이 문제인지 알려 줍니다.",
  },
  example: {
    in: `flowchart TD
  A([시작]) --> B{재고 있나?}
  B -->|예| C[주문 확정]
  B -->|아니오| D[품절 안내]`,
    out: `  (시작)
     ↓
  <재고 있나?>
   예↙    ↘아니오
[주문 확정] [품절 안내]`,
    outLabel: "나오는 그림",
  },
  notes: [
    "'그리기' 탭에서는 문법 없이 마우스로 직접 그립니다 — 상자를 놓고, 오른쪽 점을 끌어 연결하고, 내용은 옆 패널에서 고칩니다. 그림은 이 브라우저에 자동 저장되고 SVG·PNG·JSON 으로 내보낼 수 있습니다.",
    "모양이 뜻입니다 — [사각형] 처리, {마름모} 조건, ([둥근]) 시작·끝, [(원통)] 데이터베이스. 모양만 봐도 무엇인지 알게 하는 것이 순서도의 핵심입니다.",
    "첫 줄의 flowchart TD 를 LR 로 바꾸면 가로로 눕습니다(TD 위→아래, LR 왼→오른쪽, BT·RL 도 됩니다). 분기가 많으면 세로, 단계가 길면 가로가 읽기 좋습니다.",
    "화살표 조건은 -->|예| 처럼 세로줄로 감싸 씁니다. 어느 쪽이 어느 경우인지 적어 두지 않으면 나중에 본인도 모릅니다.",
    "subgraph 이름 … end 로 감싸면 상자로 묶입니다. 시스템 경계나 담당 팀을 나눌 때 씁니다.",
  ],
};

export function FlowchartPage() {
  return (
    <DiagramTool
      tool={tool}
      type="flowchart"
      guide={GUIDE}
      intro="조건과 분기가 있는 처리 흐름을 그립니다. 로직 설명과 의사결정 정리에 씁니다."
    />
  );
}
