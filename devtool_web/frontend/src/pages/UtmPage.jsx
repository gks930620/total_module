// UTM 링크 생성 · 분해
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { UTM_FIELDS, buildUtmUrl, parseUtmUrl } from "../lib/webTools.js";

const tool = getToolBySlug("utm");

const GUIDE = {
  intro: "링크와 캠페인 정보를 넣으면 UTM 파라미터가 붙은 추적용 링크를 만들어 줍니다. 반대로 이미 UTM 이 붙은 링크를 아래 칸에 넣으면 원본 링크와 파라미터로 분해해 주므로, 값만 고쳐 다시 만들 수 있습니다.",
  screen: {
    layout: "stack",
    left: { head: "링크 · source · medium · campaign · term · content", body: "소문자로 통일 체크" },
    right: { head: "완성된 링크 → 링크에서 분해하기", body: "링크 복사 · 분해한 값 불러오기" },
    caption: "값을 채우면 완성된 링크가 바로 만들어집니다.",
  },
  example: {
    in: `링크      https://example.com/landing
source    naver
medium    cpc
campaign  summer_sale`,
    out: "https://example.com/landing?utm_source=naver&utm_medium=cpc&utm_campaign=summer_sale",
  },
  notes: [
    "UTM 은 링크에 붙이는 추적용 파라미터입니다 — 어디서(source), 어떤 방식으로(medium), 어떤 캠페인으로(campaign) 들어왔는지 분석 도구가 구분할 수 있게 해 줍니다.",
    "필수는 source·medium·campaign 세 가지이고 term·content 는 선택입니다.",
    "UTM 값은 대소문자를 구분합니다. 'Naver' 와 'naver' 가 다른 유입처로 집계돼 통계가 갈라지는 사고가 흔해서 기본으로 소문자·밑줄로 통일합니다.",
    "이미 UTM 이 붙은 링크는 '링크에서 분해하기' 에 넣으면 원본과 파라미터로 나눠 줍니다.",
  ],
};

export function UtmPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [base, setBase] = useState("");
  const [params, setParams] = useState({ utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" });
  const [lowercase, setLowercase] = useState(true);
  const [parseInput, setParseInput] = useState("");

  const result = useMemo(() => buildUtmUrl(base, params, { lowercase }), [base, params, lowercase]);
  const parsed = useMemo(() => (parseInput.trim() ? parseUtmUrl(parseInput) : null), [parseInput]);

  const setField = (k, v) => { setParams((p) => ({ ...p, [k]: v })); };

  const applyParsed = () => {
    if (!parsed?.ok) return;
    setBase(parsed.base);
    setParams({ utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "", ...parsed.params });
  };

  return (
    <article className="tool-page">
      <ToolHeader title="UTM 링크 만들기" description="캠페인 추적용 UTM 파라미터를 붙인 링크를 만듭니다." />

      <div className="field">
        <span>링크</span>
        <input className="krw-input" value={base} onChange={(e) => { setBase(e.target.value); }}
          placeholder="https://example.com/landing" />
      </div>

      {UTM_FIELDS.map((f) => (
        <div className="field" key={f.key}>
          <span>{f.label} — {f.hint}</span>
          <input className="krw-input" value={params[f.key]} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.key} />
          {f.presets.length > 0 && (
            <div className="chip-row" style={{ marginTop: 8, marginBottom: 0 }}>
              {f.presets.map((p) => (
                <button key={p} type="button" className={`chip ${params[f.key] === p ? "on" : ""}`} onClick={() => setField(f.key, p)}>{p}</button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="toolbar">
        <label className="check-inline">
          <input type="checkbox" checked={lowercase} onChange={(e) => setLowercase(e.target.checked)} />
          소문자·밑줄로 통일 (권장)
        </label>
      </div>

      {!result.ok ? <div className="notice error">{result.reason}</div> : (
        <>
          {result.warn && <div className="notice warn">{result.warn}</div>}
          <h2 className="sub-heading">완성된 링크<CopyButton value={() => result.url} label="복사" /></h2>
          <textarea className="area code readonly" rows={3} value={result.url} readOnly spellCheck={false} />
        </>
      )}

      <h2 className="sub-heading">링크에서 분해하기</h2>
      <div className="field">
        <span>UTM 이 붙은 링크를 붙여넣으세요</span>
        <input className="krw-input" value={parseInput} onChange={(e) => setParseInput(e.target.value)}
          placeholder="https://example.com/?utm_source=naver&utm_medium=cpc" />
      </div>
      {parsed && (parsed.ok ? (
        <>
          <div className="kv-card">
            <div className="kv-row"><span className="kv-label">원본 링크</span><span className="kv-value mono break">{parsed.base}</span></div>
            {Object.entries(parsed.params).map(([k, v]) => (
              <div className="kv-row" key={k}><span className="kv-label">{k}</span><span className="kv-value mono">{v}</span></div>
            ))}
          </div>
          {parsed.found > 0 && <button type="button" className="btn primary" onClick={applyParsed}>위 값으로 폼 채우기</button>}
          {parsed.found === 0 && <p className="hint">UTM 파라미터가 없는 링크입니다.</p>}
        </>
      ) : <div className="notice error">{parsed.reason}</div>)}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
