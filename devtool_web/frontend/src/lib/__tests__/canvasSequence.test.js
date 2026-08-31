// 시퀀스 그리기 — 참가자·메시지 모델. 구현 전 선작성(Red).
// 시퀀스는 상자-화살표 모델이 아니라(세로줄 + 시간순) 캔버스 편집기와 모델을 따로 둔다.
import { describe, it, expect } from "vitest";
import {
  createSeq, addParticipant, renameParticipant, moveParticipant, removeParticipant,
  addMessage, updateMessage, moveMessage, removeMessage,
  serializeSeq, deserializeSeq, toSequenceMermaid, toSequenceSvg,
} from "../canvas/sequence.js";

const basic = () => {
  let s = createSeq();
  let a, b;
  [s, a] = addParticipant(s, "클라이언트");
  [s, b] = addParticipant(s, "서버");
  [s] = addMessage(s, { from: a, to: b, label: "로그인 요청", kind: "sync" });
  [s] = addMessage(s, { from: b, to: a, label: "토큰 발급", kind: "reply" });
  return { s, a, b };
};

describe("참가자", () => {
  it("추가·이름 바꾸기", () => {
    let s = createSeq();
    let id;
    [s, id] = addParticipant(s, "클라이언트");
    s = renameParticipant(s, id, "브라우저");
    expect(s.participants[0].name).toBe("브라우저");
  });

  it("순서를 옮긴다", () => {
    const { s, a } = basic();
    const moved = moveParticipant(s, a, +1);
    expect(moved.participants.map((p) => p.name)).toEqual(["서버", "클라이언트"]);
  });

  it("참가자를 지우면 걸린 메시지도 사라진다", () => {
    const { s, b } = basic();
    const next = removeParticipant(s, b);
    expect(next.participants).toHaveLength(1);
    expect(next.messages).toHaveLength(0);
  });
});

describe("메시지", () => {
  it("고치기·순서 바꾸기·지우기", () => {
    let { s } = basic();
    const [m1, m2] = s.messages.map((m) => m.id);
    s = updateMessage(s, m1, { label: "인증 요청" });
    expect(s.messages[0].label).toBe("인증 요청");
    s = moveMessage(s, m2, -1);
    expect(s.messages[0].id).toBe(m2);
    s = removeMessage(s, m2);
    expect(s.messages).toHaveLength(1);
  });
});

describe("저장·불러오기", () => {
  it("왕복해도 같다", () => {
    const { s } = basic();
    const r = deserializeSeq(serializeSeq(s));
    expect(r.ok).toBe(true);
    expect(r.seq.participants).toEqual(s.participants);
    expect(r.seq.messages).toEqual(s.messages);
  });

  it("쓰레기는 ok:false", () => {
    expect(deserializeSeq("x").ok).toBe(false);
    expect(deserializeSeq('{"v":1,"type":"er"}').ok).toBe(false);
  });
});

describe("mermaid 내보내기", () => {
  it("participant 와 화살표 두 종류가 나온다", () => {
    const { s } = basic();
    const t = toSequenceMermaid(s);
    expect(t).toContain("sequenceDiagram");
    expect(t).toContain("participant");
    expect(t).toContain("->>");    // 요청(실선)
    expect(t).toContain("-->>");   // 응답(점선)
    expect(t).toContain("로그인 요청");
  });
});

describe("SVG 내보내기", () => {
  it("완결된 SVG 이고 라벨이 이스케이프된다", () => {
    let s = createSeq();
    let a, b;
    [s, a] = addParticipant(s, "A<서버>");
    [s, b] = addParticipant(s, "B");
    [s] = addMessage(s, { from: a, to: b, label: "저장 & 응답", kind: "sync" });
    const svg = toSequenceSvg(s);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("&lt;서버&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).not.toContain("var(--");
  });

  it("자기 자신에게 보내는 메시지도 그려진다", () => {
    let s = createSeq();
    let a;
    [s, a] = addParticipant(s, "서버");
    [s] = addMessage(s, { from: a, to: a, label: "재시도", kind: "sync" });
    expect(toSequenceSvg(s)).toContain("재시도");
  });
});
