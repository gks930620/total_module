// 텍스트 비교 (diff) — IDE 의 "Compare With" 처럼 좌우로 마주 놓고 본다.
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { diffLines, toSideBySide } from "../lib/diff.js";

const tool = getToolBySlug("diff");

/** 예시 — 한 줄은 그대로, 한 줄은 값만 바뀌고, 한 줄은 사라진다 */
const SAMPLE_LEFT = `name: 김철수
dept: 개발팀
tel: 010-1111-2222`;
const SAMPLE_RIGHT = `name: 김철수
dept: 기획팀`;

const GUIDE = {
  intro: "왼쪽에 원본, 오른쪽에 바뀐 글을 넣으면 아래에 두 벌을 나란히 놓고 줄을 맞춰 보여 줍니다. 바뀐 줄은 왼쪽이 빨강·오른쪽이 초록으로 마주 보고, 한쪽에만 있는 줄은 반대쪽이 빈 칸으로 남습니다.",
  screen: {
    layout: "split",
    left: { head: "원본 (왼쪽)", body: "비교할 원본 텍스트" },
    right: { head: "비교 대상 (오른쪽)", body: "바뀐 텍스트" },
    caption: "두 칸을 채우면 아래에 좌우 비교 화면이 나옵니다.",
  },
  example: {
    in: `원본            비교 대상
name: 김철수    name: 김철수
dept: 개발팀    dept: 기획팀`,
    inLabel: "넣는 값 (두 칸)",
    out: `1  name: 김철수  │ 1  name: 김철수
2  dept: 개발팀  │ 2  dept: 기획팀
   (빨강)        │    (초록)`,
    outLabel: "나오는 값 (좌우 비교)",
  },
  notes: [
    "줄 단위 비교입니다. LCS(최장 공통 부분수열)로 공통 줄을 찾고, 이어진 삭제·추가는 서로 마주 놓아 무엇이 무엇으로 바뀌었는지 보이게 합니다.",
    "'바뀐 줄만' 을 켜면 같은 줄은 감추고 달라진 줄만 남깁니다. 긴 파일에서 차이만 훑을 때 씁니다.",
    "'좌우 교체 ⇄' 는 두 칸의 내용을 맞바꿉니다 — 어느 쪽이 원본인지 헷갈릴 때 눌러 보면 됩니다.",
    "앞뒤 공통 구간을 먼저 잘라내므로 대부분 빠릅니다. 다만 완전히 다른 2,000줄 이상이면 브라우저 보호를 위해 통삭제·통추가로 표시합니다.",
    "붙여넣은 내용은 브라우저 안에서만 비교합니다. 서버로 보내지 않습니다.",
  ],
};

export function DiffPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [onlyChanges, setOnlyChanges] = useState(false);

  // 좌우로 마주 놓고 본다 — IDE 의 "Compare With" 와 같은 배치다.
  const rows = useMemo(() => toSideBySide(diffLines(left, right)), [left, right]);
  const visible = onlyChanges ? rows.filter((r) => r.type !== "=") : rows;

  const touched = left !== "" || right !== "";

  return (
    <article className="tool-page">
      <ToolHeader title="텍스트 비교 (diff)" description="두 텍스트를 좌우로 나란히 놓고 줄 단위 차이를 색으로 보여줍니다." />

      <div className="toolbar">
        <label className="check-inline">
          <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} />
          바뀐 줄만
        </label>
        <div className="toolbar-right">
          <button type="button" className="btn" onClick={() => { setLeft(SAMPLE_LEFT); setRight(SAMPLE_RIGHT); }}>예시 넣기</button>
          <button type="button" className="btn" onClick={() => { const l = left; setLeft(right); setRight(l); }}>좌우 교체 ⇄</button>
          <button type="button" className="btn ghost" onClick={() => { setLeft(""); setRight(""); }}>지우기</button>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head"><span>원본 (왼쪽)</span></div>
          <textarea
            className="area code"
            rows={12}
            value={left}
            onChange={(e) => { setLeft(e.target.value); }}
            placeholder="비교할 원본 텍스트"
            spellCheck={false}
          />
        </div>
        <div className="panel">
          <div className="panel-head"><span>비교 대상 (오른쪽)</span></div>
          <textarea
            className="area code"
            rows={12}
            value={right}
            onChange={(e) => { setRight(e.target.value); }}
            placeholder="바뀐 텍스트"
            spellCheck={false}
          />
        </div>
      </div>

      {touched && (
        <div className="diff-side">
          {visible.length === 0 ? (
            <div className="empty-state">차이가 없습니다.</div>
          ) : (
            <div className="diff-grid">
              {visible.map((r, i) => (
                <div
                  key={i}
                  className={`diff-line diff-${r.type === "=" ? "eq" : r.type === "~" ? "chg" : r.type === "+" ? "add" : "del"}`}
                >
                  <span className="diff-no">{r.left?.leftNo ?? ""}</span>
                  <span className="diff-cell">{r.left ? r.left.text || " " : ""}</span>
                  <span className="diff-no">{r.right?.rightNo ?? ""}</span>
                  <span className="diff-cell">{r.right ? r.right.text || " " : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
