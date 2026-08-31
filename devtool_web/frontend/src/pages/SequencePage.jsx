// sequence — 화면은 components/DiagramTool.jsx 하나를 함께 쓴다.
// 종류마다 페이지를 따로 두는 이유는 검색이다("ERD 그리기" 와 "시퀀스 다이어그램" 은 다른 검색어).
import { DiagramTool } from "../components/DiagramTool.jsx";
import { getToolBySlug } from "../lib/tools.js";

const tool = getToolBySlug("sequence");

const GUIDE = {
  intro: "누가 누구에게 무엇을 언제 보내는지를 그립니다. 왼쪽에 mermaid 문법으로 쓰거나 위에서 예시를 넣어 한 줄씩 고치면 되고, 오른쪽 그림은 타이핑과 동시에 다시 그려집니다.",
  screen: {
    layout: "split",
    left: { head: "다이어그램 문법", body: "예시를 넣고 한 줄씩 고치기" },
    right: { head: "미리보기", body: "확대·축소 · SVG 저장 · PNG 저장" },
    caption: "문법이 틀리면 몇 번째 줄이 문제인지 알려 줍니다.",
  },
  example: {
    in: `sequenceDiagram
  autonumber
  participant C as 클라이언트
  participant S as 서버
  C->>S: 로그인 요청
  S-->>C: 토큰 발급`,
    out: `클라이언트 ──1 로그인 요청──> 서버
클라이언트 <--2 토큰 발급---- 서버`,
    outLabel: "나오는 그림",
  },
  notes: [
    "'그리기' 탭에서는 문법 없이 만듭니다 — 참가자와 메시지를 목록으로 넣으면 그림이 바로 그려지고, 메시지의 위아래 순서가 곧 시간 순서입니다. 브라우저에 자동 저장됩니다.",
    "->> 는 실선(요청), -->> 는 점선(응답)입니다. 요청과 응답을 눈으로 구분할 수 있어야 흐름이 읽힙니다. -) 는 비동기 호출입니다.",
    "조건 분기는 alt / else / end 로 감쌉니다. 반복은 loop, 선택 실행은 opt 입니다.",
    "participant S as 서버 처럼 as 뒤에 한글 이름을 쓰면 그대로 나옵니다. 화살표 뒤 메시지에도 한글을 씁니다.",
    "첫 줄에 autonumber 를 넣으면 메시지마다 번호가 붙어 '3번 단계' 처럼 문서에서 가리킬 수 있습니다.",
  ],
};

export function SequencePage() {
  return (
    <DiagramTool
      tool={tool}
      type="sequence"
      guide={GUIDE}
      intro="누가 누구에게 무엇을 언제 보내는지 그립니다. API 흐름과 인증 절차를 설명할 때 씁니다."
    />
  );
}
