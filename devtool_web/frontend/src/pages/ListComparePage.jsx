// 목록 대조 — 엑셀 VLOOKUP 대신. 순서를 보지 않는다는 점이 /diff 와 다르다.
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { compareLists } from "../lib/textTools.js";

const tool = getToolBySlug("list-compare");

/** 예시 — 순서가 다르고, 한쪽에만 있는 사람이 있고, 한쪽에는 중복이 있다 */
const SAMPLE_LEFT = `김철수
이영희
박민수`;
const SAMPLE_RIGHT = `박민수
김철수
최지우
박민수`;

const GUIDE = {
  intro: "엑셀에서 VLOOKUP 으로 하던 일을 대신합니다. 두 명단을 한 줄에 하나씩 붙여넣으면 양쪽에 다 있는 것, 왼쪽에만 있는 것, 오른쪽에만 있는 것으로 갈라 줍니다. 각 목록 안의 중복도 따로 찾아 줍니다.",
  screen: {
    layout: "split",
    left: { head: "목록 A (줄 수 · 고유 개수)", body: "한 줄에 하나씩" },
    right: { head: "목록 B (줄 수 · 고유 개수)", body: "한 줄에 하나씩" },
    caption: "두 칸을 채우면 아래에 교집합·차집합·중복이 상자별로 나옵니다.",
  },
  example: {
    in: `목록 A        목록 B
김철수        김철수
이영희        박민수
박민수        박민수`,
    out: `양쪽에 다 있음   김철수, 박민수
A 에만 있음      이영희
B 에만 있음      없음
B 안의 중복      박민수`,
  },
  notes: [
    "앞뒤 공백은 기본으로 무시합니다. 대소문자 무시는 위 체크로 켜면 됩니다.",
    "각 목록 안에서 같은 값이 두 번 이상 나오면 중복으로 따로 모아 줍니다 — 참가자 명단에 같은 이름이 두 번 들어간 경우를 찾을 때 씁니다.",
    "상자마다 복사 버튼이 있어 결과를 바로 다른 곳에 붙일 수 있습니다. 목록이 길면 앞 500개만 화면에 보여 줍니다.",
    "순서를 보지 않습니다. 두 명단의 줄 순서가 달라도 같은 항목은 '양쪽에 다 있음' 으로 묶입니다 — 이게 /diff 와 가장 다른 점입니다.",
    "/diff 는 '몇 번째 줄이 어떻게 바뀌었나' 를 봅니다(코드·설정 파일). 순서가 뒤섞인 명단에 쓰면 옮겨진 줄까지 전부 삭제+추가로 잡혀 못 씁니다. 순서가 의미 없는 목록이면 이 도구입니다.",
    "브라우저 안에서만 대조합니다 — 고객 명단이나 사번 목록을 넣어도 밖으로 나가지 않습니다.",
  ],
};

function ResultBox({ title, items, tone }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span>{title} · {items.length}개</span>
        {items.length > 0 && <CopyButton value={() => items.join("\n")} label="복사" />}
      </div>
      <div style={{ padding: "12px 18px", maxHeight: 320, overflow: "auto" }}>
        {items.length === 0 ? <p className="muted" style={{ margin: 0 }}>없음</p> : (
          <ul className={`plain-list ${tone || ""}`}>
            {items.slice(0, 500).map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        )}
        {items.length > 500 && <p className="hint">앞 500개만 표시합니다.</p>}
      </div>
    </div>
  );
}

export function ListComparePage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [ignoreCase, setIgnoreCase] = useState(false);

  const r = useMemo(() => compareLists(left, right, { ignoreCase }), [left, right, ignoreCase]);
  const touched = left.trim() !== "" || right.trim() !== "";

  return (
    <article className="tool-page">
      <ToolHeader title="목록 대조" description="두 명단을 순서 무시하고 대조합니다. 엑셀 VLOOKUP 대신 쓰는 도구입니다." />

      <div className="toolbar">
        <label className="check-inline"><input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} />대소문자 무시</label>
        <div className="toolbar-right">
          <button type="button" className="btn" onClick={() => { setLeft(SAMPLE_LEFT); setRight(SAMPLE_RIGHT); }}>예시 넣기</button>
          <button type="button" className="btn" onClick={() => { const l = left; setLeft(right); setRight(l); }}>좌우 교체 ⇄</button>
          <button type="button" className="btn ghost" onClick={() => { setLeft(""); setRight(""); }}>지우기</button>
        </div>
      </div>

      <div className="split">
        <div className="field">
          <span>목록 A ({r.leftCount}줄 · 고유 {r.leftUnique}개)</span>
          <textarea className="area code" rows={10} value={left} onChange={(e) => { setLeft(e.target.value); }}
            placeholder="한 줄에 하나씩" spellCheck={false} />
        </div>
        <div className="field">
          <span>목록 B ({r.rightCount}줄 · 고유 {r.rightUnique}개)</span>
          <textarea className="area code" rows={10} value={right} onChange={(e) => setRight(e.target.value)}
            placeholder="한 줄에 하나씩" spellCheck={false} />
        </div>
      </div>

      {touched && (
        <>
          <div className="count-grid">
            <div className="count-big accent"><span className="v">{r.both.length}</span><span className="l">양쪽 모두</span></div>
            <div className="count-big"><span className="v">{r.onlyLeft.length}</span><span className="l">A에만</span></div>
            <div className="count-big"><span className="v">{r.onlyRight.length}</span><span className="l">B에만</span></div>
            <div className="count-big"><span className="v">{r.union.length}</span><span className="l">합집합</span></div>
          </div>

          <div className="split three">
            <ResultBox title="양쪽 모두 (교집합)" items={r.both} tone="ok" />
            <ResultBox title="A에만 있음" items={r.onlyLeft} tone="warn" />
            <ResultBox title="B에만 있음" items={r.onlyRight} tone="warn" />
          </div>

          {(r.leftDuplicates.length > 0 || r.rightDuplicates.length > 0) && (
            <div className="notice warn">
              <strong>목록 안 중복</strong> —
              {r.leftDuplicates.length > 0 && ` A: ${r.leftDuplicates.slice(0, 8).join(", ")}${r.leftDuplicates.length > 8 ? ` 외 ${r.leftDuplicates.length - 8}개` : ""}`}
              {r.leftDuplicates.length > 0 && r.rightDuplicates.length > 0 && " / "}
              {r.rightDuplicates.length > 0 && ` B: ${r.rightDuplicates.slice(0, 8).join(", ")}${r.rightDuplicates.length > 8 ? ` 외 ${r.rightDuplicates.length - 8}개` : ""}`}
            </div>
          )}
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
