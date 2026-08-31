// state-diagram — 화면은 components/DiagramTool.jsx 하나를 함께 쓴다.
// 종류마다 페이지를 따로 두는 이유는 검색이다("ERD 그리기" 와 "시퀀스 다이어그램" 은 다른 검색어).
import { DiagramTool } from "../components/DiagramTool.jsx";
import { getToolBySlug } from "../lib/tools.js";

const tool = getToolBySlug("state-diagram");

const GUIDE = {
  intro: "대상이 어떤 상태를 오가는지 그립니다 — 주문 상태, 결제 단계, 문서 승인 흐름. 상태 이름과 화살표만 적으면 되고, 화살표 뒤에 콜론을 찍어 '무엇 때문에 넘어가는가' 를 적는 것이 핵심입니다.",
  screen: {
    layout: "split",
    left: { head: "다이어그램 문법", body: "예시를 넣고 한 줄씩 고치기" },
    right: { head: "미리보기", body: "확대·축소 · SVG 저장 · PNG 저장" },
    caption: "문법이 틀리면 몇 번째 줄이 문제인지 알려 줍니다.",
  },
  example: {
    in: `stateDiagram-v2
  [*] --> 결제대기
  결제대기 --> 결제완료: 결제 승인
  결제대기 --> 취소: 시간 초과
  결제완료 --> [*]`,
    out: `● → 결제대기 ──결제 승인──> 결제완료 → ◉
        └──시간 초과──> 취소`,
    outLabel: "나오는 그림",
  },
  notes: [
    "'그리기' 탭에서는 문법 없이 마우스로 직접 그립니다 — 상자를 놓고, 오른쪽 점을 끌어 연결하고, 내용은 옆 패널에서 고칩니다. 그림은 이 브라우저에 자동 저장되고 SVG·PNG·JSON 으로 내보낼 수 있습니다.",
    "[*] 는 시작과 끝입니다. [*] --> 대기 는 '처음에는 대기 상태', 완료 --> [*] 는 '거기서 끝난다' 는 뜻입니다 — 끝을 안 그리면 상태가 영원히 남는 것처럼 보입니다.",
    "전이 조건은 화살표 뒤에 콜론을 찍고 적습니다. '무엇 때문에 넘어가는가' 가 없으면 그림이 반쪽입니다.",
    "state 이름 { … } 로 감싸면 상태 안에 상태를 넣을 수 있습니다 — 바깥에서 보면 하나, 안을 열면 여러 단계인 경우에 씁니다.",
    "순서도는 '무엇을 하는가'(처리의 흐름), 상태 다이어그램은 '무엇인가'(놓인 상태)를 그립니다. 주문이 결제대기에서 결제완료로 바뀌는 건 상태이고, 결제를 시도하고 실패하면 되돌리는 건 순서도입니다.",
  ],
};

export function StateDiagramPage() {
  return (
    <DiagramTool
      tool={tool}
      type="state"
      guide={GUIDE}
      intro="무엇이 어떤 상태를 오가는지 그립니다. 주문 상태·결제 단계·문서 승인 흐름에 씁니다."
    />
  );
}
