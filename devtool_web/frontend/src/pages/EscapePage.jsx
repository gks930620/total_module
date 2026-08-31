// 문자열 이스케이프 변환
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { escapeText, unescapeText, ESCAPE_MODES } from "../lib/escape.js";

const tool = getToolBySlug("escape");

const GUIDE = {
  intro: "위 칩에서 종류(JSON·HTML·SQL·정규식·유니코드)를 고르고 왼쪽에 원문을 넣으면 오른쪽에 이스케이프된 문자열이 나옵니다. 가운데 화살표를 누르면 방향이 바뀌어 이스케이프된 값을 원문으로 되돌립니다.",
  screen: {
    layout: "split",
    left: { head: "입력 · 원문", body: "그는 \"안녕\"이라 했다" },
    right: { head: "출력 · 고른 종류", body: "결과 · 복사" },
    caption: "가운데 화살표를 누르면 이스케이프 ↔ 복원으로 방향이 바뀝니다.",
  },
  example: {
    in: "그는 \"안녕\"이라 했다",
    inLabel: "넣는 값 (JSON 종류)",
    out: "그는 \\\"안녕\\\"이라 했다",
  },
  notes: [
    "SQL 이스케이프는 표시·확인용입니다. 실제 쿼리는 반드시 바인딩 파라미터(PreparedStatement)를 쓰세요 — 문자열을 이어붙이면 어떤 이스케이프를 해도 인젝션 위험이 남습니다.",
    "HTML 이스케이프는 본문에 넣을 때는 도움이 되지만 속성값·URL·스크립트 안에서는 규칙이 다릅니다. 프레임워크의 기본 이스케이프를 끄지 않는 편이 안전합니다.",
    "정규식 이스케이프는 사용자 입력을 패턴에 넣을 때 씁니다 — 안 하면 입력의 . * ( ) 가 메타문자로 해석됩니다.",
    "이모지처럼 BMP 밖 문자는 유니코드 이스케이프에서 서로게이트 쌍 두 개로 쪼개집니다. JS·자바 문자열 리터럴 규약과 같습니다.",
  ],
};

export function EscapePage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [mode, setMode] = useState("json");
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState("escape");

  const output = useMemo(
    () => (direction === "escape" ? escapeText(input, mode) : unescapeText(input, mode)),
    [input, mode, direction]
  );

  const current = ESCAPE_MODES.find((m) => m.key === mode);
  const escaping = direction === "escape";

  // 방향을 뒤집으면 지금 결과가 다음 입력이 된다 — 이스케이프한 값을 바로 되돌려 볼 수 있다
  const flip = () => {
    setInput(output || "");
    setDirection(escaping ? "unescape" : "escape");
  };

  return (
    <article className="tool-page">
      <ToolHeader title="문자열 이스케이프" description="JSON·HTML·SQL·정규식·유니코드 이스케이프를 상호 변환합니다." />

      <div className="chip-row" role="group" aria-label="이스케이프 종류">
        {ESCAPE_MODES.map((m) => (
          <button key={m.key} type="button" className={`chip ${mode === m.key ? "on" : ""}`} onClick={() => setMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="hint">{current?.hint}</p>

      {/* 방향은 두 패널 사이에서 보여 준다 — 위에 토글을 두면 지금 어느 쪽인지 따로 읽어야 한다 */}
      <div className="split with-swap">
        <section className="panel">
          <div className="panel-head tools">
            <span>입력 · {escaping ? "원문" : current?.label}</span>
            <div className="panel-tools">
              <button type="button" className="btn ghost" onClick={() => setInput("")}>비우기</button>
            </div>
          </div>
          <textarea
            className="area code"
            rows={12}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={escaping ? '그는 "안녕"이라 했다' : '그는 \\"안녕\\"이라 했다'}
            spellCheck={false}
            aria-label="입력"
          />
        </section>

        <div className="swap-slot">
          <button type="button" className="dir-btn" onClick={flip} title="방향 바꾸기">
            <span className="dir-arrow" aria-hidden="true">→</span>
            <span className="dir-label">{escaping ? "이스케이프" : "복원"}</span>
          </button>
        </div>

        <section className="panel">
          <div className="panel-head tools">
            <span>출력 · {escaping ? current?.label : "원문"}</span>
            <div className="panel-tools">
              {output && <CopyButton value={() => output} label="복사" />}
            </div>
          </div>
          <textarea className="area code readonly" rows={12} value={output} readOnly spellCheck={false} aria-label="결과" />
        </section>
      </div>

      {mode === "sql" && (
        <div className="notice warn">
          <strong>보안 주의</strong> — 이 변환은 표시·확인용입니다. 실제 쿼리는 반드시 바인딩 파라미터(PreparedStatement)를 쓰세요.
        </div>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
