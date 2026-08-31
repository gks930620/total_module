// URL 인코더/디코더 · 쿼리스트링 파서
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { encodeComponent, decodeComponent, encodeFull, decodeFull, parseUrl, parseQuery } from "../lib/urlTool.js";

const tool = getToolBySlug("url");

/** 예시 — 한글이 든 URL 전체와, 이미 인코딩된 파라미터 값 하나 */
const SAMPLE_URL = "https://example.com/검색?q=한글 검색어&page=2";
const SAMPLE_ENCODED = "%ED%95%9C%EA%B8%80%20%EA%B2%80%EC%83%89%EC%96%B4";

const GUIDE = {
  intro: "URL 이나 파라미터 값을 넣으면 인코딩 결과와 디코딩 결과를 나란히 보여 줍니다. 온전한 URL 이면 프로토콜·호스트·경로로 쪼개고 쿼리 파라미터를 표로 풀어 주므로, 긴 링크에서 값 하나만 확인할 때 편합니다.",
  screen: {
    layout: "split",
    left: { head: "인코딩 결과", body: "component / full 선택" },
    right: { head: "디코딩 결과", body: "결과 복사" },
    caption: "입력 한 칸에 넣으면 인코딩·디코딩 결과가 동시에 나옵니다.",
  },
  example: {
    in: "https://example.com/검색?q=한글&page=2",
    out: `디코딩 결과와 함께 아래에

호스트   example.com
경로     /검색
q        한글
page     2`,
  },
  notes: [
    "component 는 : / ? & = 까지 전부 인코딩합니다(파라미터 값에 씁니다). full 은 URL 구조 문자를 남기고 나머지만 인코딩합니다(URL 전체에 씁니다).",
    "쿼리스트링 관례(application/x-www-form-urlencoded)상 + 는 공백입니다 — 파라미터 표는 이 관례를 따라 디코딩합니다.",
    "UTF-8 기준입니다. EUC-KR 로 인코딩된 URL 은 표준 percent 디코딩으로 복원되지 않습니다.",
    "잘못된 % 시퀀스가 있으면 알려 주고, 파라미터 표에서는 파싱 전체가 멈추지 않도록 해당 값만 원문 그대로 보여 줍니다.",
  ],
};

export function UrlPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [input, setInput] = useState("");
  const [mode, setMode] = useState("component");

  const run = (fn) => {
    try {
      return { ok: true, value: fn(input) };
    } catch (e) {
      return { ok: false, error: `변환 실패: ${e.message}` };
    }
  };

  const encoded = useMemo(
    () => run(mode === "component" ? encodeComponent : encodeFull),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, mode]
  );
  const decoded = useMemo(
    () => run(mode === "component" ? decodeComponent : decodeFull),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, mode]
  );

  const parsed = useMemo(() => parseUrl(input), [input]);
  const queryRows = useMemo(() => parseQuery(input), [input]);

  return (
    <article className="tool-page">
      <ToolHeader title="URL 인코더 · 쿼리 파서" description="URL을 인코딩·디코딩하고 구성요소와 쿼리 파라미터로 분해합니다." />

      <div className="toolbar">
        <div className="seg">
          <button type="button" className={mode === "component" ? "on" : ""} onClick={() => setMode("component")}>
            component (값용)
          </button>
          <button type="button" className={mode === "full" ? "on" : ""} onClick={() => setMode("full")}>
            full (URL 전체용)
          </button>
        </div>
        <div className="toolbar-right">
          <button type="button" className="btn" onClick={() => { setMode("full"); setInput(SAMPLE_URL); }}>예시 · 한글 URL</button>
          <button type="button" className="btn" onClick={() => { setMode("component"); setInput(SAMPLE_ENCODED); }}>예시 · 인코딩된 값</button>
          <button type="button" className="btn ghost" onClick={() => setInput("")}>지우기</button>
        </div>
      </div>

      <div className="field">
        <span>입력</span>
        <textarea
          className="area"
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://example.com/검색?q=한글&page=2"
          spellCheck={false}
        />
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head">
            <span>인코딩 결과</span>
            {encoded.ok && <CopyButton value={() => encoded.value} />}
          </div>
          {encoded.ok
            ? <textarea className="area readonly" rows={3} value={encoded.value} readOnly />
            : <div className="notice error">{encoded.error}</div>}
        </div>
        <div className="panel">
          <div className="panel-head">
            <span>디코딩 결과</span>
            {decoded.ok && <CopyButton value={() => decoded.value} />}
          </div>
          {decoded.ok
            ? <textarea className="area readonly" rows={3} value={decoded.value} readOnly />
            : <div className="notice error">{decoded.error}</div>}
        </div>
      </div>

      {parsed.ok && (
        <>
          <h2 className="sub-heading">URL 구조</h2>
          <div className="kv-card">
            {[
              ["스킴", parsed.protocol],
              ["사용자", parsed.username || "—"],
              ["호스트", parsed.hostname],
              ["포트", parsed.port || "(기본)"],
              ["경로", parsed.pathname],
              ["쿼리", parsed.search || "—"],
              ["프래그먼트", parsed.hash || "—"],
              ["origin", parsed.origin],
            ].map(([k, v]) => (
              <div className="kv-row" key={k}>
                <span className="kv-label">{k}</span>
                <span className="kv-value mono">{v}</span>
              </div>
            ))}
          </div>
          {parsed.segments.length > 0 && (
            <p className="hint">경로 세그먼트: {parsed.segments.map((s, i) => <code key={i} className="chip-inline">{s}</code>)}</p>
          )}
        </>
      )}

      {queryRows.length > 0 && (
        <>
          <h2 className="sub-heading">쿼리 파라미터 ({queryRows.length}개)</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>#</th><th>키</th><th>값 (디코딩)</th><th>원본</th></tr></thead>
              <tbody>
                {queryRows.map((r, i) => (
                  <tr key={i}>
                    <td className="num">{i + 1}</td>
                    <td className="mono">{r.key}</td>
                    <td>{r.value === null ? <em className="muted">(값 없음)</em> : r.value === "" ? <em className="muted">(빈 문자열)</em> : r.value}</td>
                    <td className="mono muted">{r.raw ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
