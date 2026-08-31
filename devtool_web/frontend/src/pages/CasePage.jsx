// 문자열 케이스 변환 — 넣는 것은 왼쪽, 나온 것은 오른쪽(데이터 뷰어와 같은 배치).
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { convertCase, splitWords, CASE_STYLES } from "../lib/caseConvert.js";

const tool = getToolBySlug("case");

const SAMPLE = "user_name_id\nXMLHttpRequest\noauth2Token";

const GUIDE = {
  intro: "왼쪽에 변수명·컬럼명을 넣고 오른쪽에서 표기법을 고르면 바로 바뀝니다. 여러 줄을 붙여넣으면 줄마다 따로 변환하므로 DB 컬럼 목록을 통째로 camelCase 로 바꿀 수 있습니다.",
  screen: {
    layout: "split",
    left: { head: "입력 · 예시 넣기", body: "user_name_id 또는 XMLHttpRequest" },
    right: { head: "표기법 고르기 · 복사", body: "고른 표기법으로 바뀐 결과" },
    caption: "왼쪽에 적으면 오른쪽이 바로 바뀝니다. 표기법은 12가지입니다.",
  },
  example: {
    in: "XMLHttpRequest",
    out: `camelCase      xmlHttpRequest
snake_case     xml_http_request
kebab-case     xml-http-request
CONSTANT_CASE  XML_HTTP_REQUEST`,
    outLabel: "나오는 값 (표기법을 바꿔 가며)",
  },
  notes: [
    "연속 대문자 뒤에 '대문자+소문자' 가 오면 경계로 봅니다 — XMLHttpRequest 는 xml · http · request 로 쪼개집니다. 어떻게 쪼갰는지는 입력 칸 아래에 보여 줍니다.",
    "여러 줄을 붙여넣으면 줄마다 따로 변환합니다. DB 컬럼 목록을 통째로 camelCase 로 바꿀 때 씁니다.",
    "글자와 숫자 사이도 단어 경계입니다 — oauth2Token 은 oauth_2_token 이 됩니다.",
    "한글은 하나의 단어로 두고 구분자(_ - . 공백)만 기준으로 나눕니다.",
    "표기법 12가지: camelCase · PascalCase · snake_case · CONSTANT_CASE · kebab-case · Train-Case · dot.case · path/case · lower case · UPPER CASE · Title Case · Sentence case.",
  ],
};

export function CasePage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [input, setInput] = useState("");
  // 가장 자주 쓰는 표기법을 기본으로 둔다
  const [style, setStyle] = useState("camel");

  const output = useMemo(() => convertCase(input, style), [input, style]);
  // 결과가 이상하면 어디서 갈렸는지부터 봐야 한다 — 첫 줄의 분해 결과를 보여 준다
  const words = useMemo(() => splitWords(input.split("\n")[0] || ""), [input]);
  const current = CASE_STYLES.find((s) => s.key === style);

  return (
    <article className="tool-page">
      <ToolHeader title="케이스 변환" description="변수명·컬럼명을 12가지 표기법으로 바꿉니다." />

      <div className="split">
        <section className="panel">
          <div className="panel-head tools">
            <span>입력 (여러 줄이면 줄 단위로 변환)</span>
            <div className="panel-tools">
              <button type="button" className="btn" onClick={() => setInput(SAMPLE)}>예시 넣기</button>
              <button type="button" className="btn ghost" onClick={() => setInput("")}>비우기</button>
            </div>
          </div>
          <textarea
            className="json-input mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="user_name_id 또는 XMLHttpRequest"
            spellCheck={false}
            aria-label="바꿀 문자열"
          />
        </section>

        <section className="panel">
          <div className="panel-head tools">
            <label className="select-label">
              표기법
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                {CASE_STYLES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <div className="panel-tools">
              {output && <CopyButton value={() => output} label="복사" />}
            </div>
          </div>

          {input.trim() === "" ? (
            <div className="panel-empty">문자열을 넣으면 고른 표기법으로 바꿔 줍니다.</div>
          ) : (
            <textarea
              className="json-input mono readonly"
              value={output}
              readOnly
              spellCheck={false}
              aria-label="바뀐 문자열"
            />
          )}
        </section>
      </div>

      {/* 고른 표기법을 어디에 쓰는지 · 입력을 어떻게 쪼갰는지 */}
      <div className="statusbar">
        {current && <span>{current.label} — {current.hint}</span>}
        {words.length > 0 && (
          <span>단어 분해 {words.map((w, i) => <code key={i} className="chip-inline">{w}</code>)}</span>
        )}
      </div>

      <ToolGuide {...GUIDE} />
    </article>
  );
}
