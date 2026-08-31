// 글자수 세기 + 원고지 환산
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { countDetail, LENGTH_LIMITS } from "../lib/textTools.js";

const tool = getToolBySlug("char-count");

/** 예시 — 자기소개서 두 문장. 아래 제한 확인표가 바로 채워진다 */
const SAMPLE = `안녕하세요. 지원 동기를 말씀드리겠습니다.
저는 사용자가 겪는 불편을 코드로 줄이는 일에 보람을 느낍니다.`;

const GUIDE = {
  intro: "글을 붙여넣으면 공백 포함·제외 글자수, 단어·줄·문단, 원고지 매수를 바로 셉니다. 자기소개서·논술처럼 제한이 걸린 글은 아래 표에서 용도별 제한과 얼마나 남았는지까지 확인할 수 있습니다.",
  screen: {
    layout: "stack",
    left: { head: "텍스트를 입력하거나 붙여넣으세요", body: "여기에 글을 붙여넣으면 바로 셉니다" },
    right: { head: "큰 숫자 4개 → 자세히 → 제한 확인표", body: "글자 · 공백제외 · 단어 · 원고지" },
    caption: "위에 붙여넣으면 아래 숫자가 타이핑과 동시에 바뀝니다.",
  },
  example: {
    in: "안녕하세요 Hello 123",
    out: `글자(공백 포함)   15
글자(공백 제외)   13
단어              3
UTF-8 바이트      25`,
  },
  notes: [
    "'공백 제외' 는 띄어쓰기·줄바꿈·탭을 뺀 수입니다. '엄격' 은 제로폭 공백처럼 눈에 안 보이는 공백까지 뺍니다.",
    "원고지는 200자(20자×10행) 기준이며 공백을 포함해 셉니다. 400자 기준도 함께 보여 줍니다 — 제출처 기준을 확인하세요.",
    "이모지가 섞이면 세는 방법마다 값이 달라집니다. 큰 숫자는 대부분의 글자수 제한이 쓰는 UTF-16 길이 기준입니다.",
    "바이트 수는 DB 컬럼 길이(VARCHAR)나 SMS 90바이트 제한을 볼 때 씁니다. 한글은 UTF-8 3바이트, EUC-KR 2바이트입니다.",
    "보이지 않는 문자가 섞여 있으면 따로 경고합니다 — 붙여넣기 과정에서 들어와 검색·비교를 깨뜨리는 것들입니다.",
    "브라우저 안에서만 셉니다. 서버로 보내지도, 저장하지도 않습니다.",
  ],
};

export function CharCountPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [text, setText] = useState("");
  const s = useMemo(() => countDetail(text), [text]);

  const onChange = (v) => {
    setText(v);
  };

  const summary = `글자 ${s.chars} · 공백제외 ${s.charsNoSpace} · 단어 ${s.words} · 줄 ${s.lines} · 원고지 ${s.manuscript200}매`;
  const hasInvisible = s.invisible.zeroWidth + s.invisible.nbsp + s.invisible.trailingSpaceLines > 0;

  return (
    <article className="tool-page">
      <ToolHeader title="글자수 세기" description="공백 포함·제외 글자수와 원고지 매수를 실시간으로 셉니다." />

      <div className="toolbar">
        <button type="button" className="btn" onClick={() => onChange(SAMPLE)}>예시 넣기</button>
        <button type="button" className="btn ghost" onClick={() => onChange("")} disabled={!text}>지우기</button>
      </div>

      <div className="field">
        <span>텍스트를 입력하거나 붙여넣으세요</span>
        <textarea
          className="area"
          rows={10}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="여기에 글을 붙여넣으면 바로 셉니다."
          spellCheck={false}
        />
      </div>

      {/* 이모지·결합문자가 있을 때만 나온다. 👨‍👩‍👧 하나가 UTF-16 8 · 코드포인트 5 · 사람 눈에 1 이다. */}
      {s.graphemes !== s.chars && (
        <div className="notice info">
          이모지나 결합문자가 있어 <b>세는 방법마다 값이 다릅니다</b> —
          사람이 보는 글자 <b>{s.graphemes.toLocaleString("ko-KR")}</b> ·
          코드포인트 <b>{s.codePoints.toLocaleString("ko-KR")}</b> ·
          UTF-16 길이 <b>{s.chars.toLocaleString("ko-KR")}</b>.
          아래 큰 숫자는 UTF-16 길이(대부분의 글자수 제한이 쓰는 기준)입니다.
        </div>
      )}

      <div className="count-grid">
        <div className="count-big">
          <span className="v">{s.chars.toLocaleString("ko-KR")}</span>
          <span className="l">글자 (공백 포함)</span>
        </div>
        <div className="count-big accent">
          <span className="v">{s.charsNoSpace.toLocaleString("ko-KR")}</span>
          <span className="l">글자 (공백 제외)</span>
        </div>
        <div className="count-big">
          <span className="v">{s.words.toLocaleString("ko-KR")}</span>
          <span className="l">단어</span>
        </div>
        <div className="count-big">
          <span className="v">{s.manuscript200.toLocaleString("ko-KR")}</span>
          <span className="l">원고지 (200자)</span>
        </div>
      </div>

      <div className="statusbar">
        <span>줄 <b>{s.lines.toLocaleString("ko-KR")}</b></span>
        <span>문단 <b>{s.paragraphs.toLocaleString("ko-KR")}</b></span>
        <span>사람이 보는 글자 <b>{s.graphemes.toLocaleString("ko-KR")}</b></span>
        <span>코드포인트 <b>{s.codePoints.toLocaleString("ko-KR")}</b></span>
        <span>공백제외(엄격) <b>{s.charsNoSpaceStrict.toLocaleString("ko-KR")}</b></span>
        <CopyButton value={() => summary} label="요약 복사" />
      </div>

      <h2 className="sub-heading">자세히</h2>
      <div className="split">
        <div className="kv-card">
          <div className="kv-row"><span className="kv-label">UTF-8 바이트</span><span className="kv-value mono">{s.bytesUtf8.toLocaleString("ko-KR")}</span></div>
          <div className="kv-row"><span className="kv-label">EUC-KR 바이트(근사)</span><span className="kv-value mono">{s.bytesEucKrApprox.toLocaleString("ko-KR")}</span></div>
          <div className="kv-row"><span className="kv-label">원고지 200자</span><span className="kv-value mono">{s.manuscript200}매 ({s.manuscript200Exact})</span></div>
          <div className="kv-row"><span className="kv-label">원고지 400자</span><span className="kv-value mono">{s.manuscript400}매</span></div>
        </div>
        <div className="kv-card">
          <div className="kv-row"><span className="kv-label">한글</span><span className="kv-value mono">{s.hangul.toLocaleString("ko-KR")}</span></div>
          <div className="kv-row"><span className="kv-label">영문</span><span className="kv-value mono">{s.latin.toLocaleString("ko-KR")}</span></div>
          <div className="kv-row"><span className="kv-label">숫자</span><span className="kv-value mono">{s.digit.toLocaleString("ko-KR")}</span></div>
          <div className="kv-row"><span className="kv-label">한자</span><span className="kv-value mono">{s.cjk.toLocaleString("ko-KR")}</span></div>
        </div>
      </div>

      {hasInvisible && (
        <div className="notice warn">
          <strong>보이지 않는 문자가 있습니다</strong> — 제로폭 공백 {s.invisible.zeroWidth}개 ·
          줄바꿈 없는 공백 {s.invisible.nbsp}개 · 줄 끝 공백 {s.invisible.trailingSpaceLines}줄.
          붙여넣기 과정에서 섞여 들어온 경우가 많고, 검색·비교에서 문제를 일으킵니다.
        </div>
      )}

      <h2 className="sub-heading">글자수 제한 확인</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>용도</th><th>제한</th><th>현재</th><th>상태</th></tr></thead>
          <tbody>
            {LENGTH_LIMITS.map((lim) => {
              const cur = lim.unit === "bytes" ? s.bytesEucKrApprox : s.chars;
              const over = cur > lim.limit;
              return (
                <tr key={lim.key}>
                  <td>{lim.label}{lim.note && <small className="muted block">{lim.note}</small>}</td>
                  <td className="mono">{lim.limit.toLocaleString("ko-KR")} {lim.unit === "bytes" ? "바이트" : "자"}</td>
                  <td className="mono">{cur.toLocaleString("ko-KR")}</td>
                  <td>
                    {text === "" ? <span className="muted">—</span>
                      : over ? <span className="tag warn">{(cur - lim.limit).toLocaleString("ko-KR")} 초과</span>
                        : <span className="tag ok">여유 {(lim.limit - cur).toLocaleString("ko-KR")}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ToolGuide {...GUIDE} />
    </article>
  );
}
