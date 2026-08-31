// 유니코드 문자 분석 · 한글 자모 분해
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { inspectChars, decomposeHangul, extractChoseong, extractJungseong, decomposeToJamo } from "../lib/unicode.js";

const tool = getToolBySlug("unicode");

const GUIDE = {
  intro: "텍스트를 넣으면 글자 하나하나의 코드포인트·UTF-8 바이트·이스케이프 표기를 표로 풀어 줍니다. 한글은 초·중·종성으로 분해하고 초성만 뽑아 주므로, 초성 검색을 구현할 때도 씁니다.",
  screen: {
    layout: "stack",
    left: { head: "분석할 텍스트", body: "한글 A 😀" },
    right: { head: "한글 자모 분해 · 초성 → 문자별 상세 표", body: "코드포인트 · UTF-8 · 이스케이프" },
    caption: "글자를 치면 아래 표가 글자 단위로 다시 만들어집니다.",
  },
  example: {
    in: "한",
    out: `코드포인트  U+D55C
UTF-8       ED 95 9C  (3바이트)
JS 이스케이프 \ud55c
HTML 엔티티  &#54620;
자모 분해    ㅎ + ㅏ + ㄴ`,
  },
  notes: [
    "제로폭 공백(U+200B)이나 줄바꿈 없는 공백(U+00A0)처럼 눈에 안 보이는 문자도 이름과 함께 표에 나옵니다 — 복사한 텍스트가 이상하게 동작할 때 원인을 찾는 데 씁니다.",
    "가족 이모지처럼 여러 코드포인트를 ZWJ(U+200D)로 이은 이모지는 실제로 여러 문자의 조합이라 표에 구성 요소가 그대로 나옵니다.",
    "초성 추출은 'ㅎㄱ' 으로 '한글' 을 찾는 초성 검색을 만들 때 씁니다. 초성·모음·자모 전체 세 가지를 각각 복사할 수 있습니다.",
    "종성이 없는 글자는 두 자만 나옵니다 — 희는 ㅎ + ㅢ 입니다. 카드의 '종' 칸에 '없음' 이라고 적히는 경우가 그것입니다.",
    "겹모음(ㅢ·ㅙ)과 겹받침(ㅄ·ㄺ)은 유니코드가 이미 한 글자로 갖고 있어 더 쪼개지 않습니다.",
    "DB 컬럼 길이가 바이트 기준(VARCHAR)이면 한글 한 글자가 3바이트입니다. 글자 수만 보고 길이를 잡으면 저장에 실패할 수 있습니다.",
    "표에는 앞 300자까지 보여 줍니다.",
  ],
};

export function UnicodePage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [input, setInput] = useState("한글 A 😀");

  const chars = useMemo(() => inspectChars(input).slice(0, 300), [input]);
  const hangul = useMemo(() => decomposeHangul(input).filter((d) => d.isHangul), [input]);
  const choseong = useMemo(() => extractChoseong(input), [input]);
  const jungseong = useMemo(() => extractJungseong(input), [input]);
  const jamo = useMemo(() => decomposeToJamo(input), [input]);

  const update = (v) => {
    setInput(v); };

  return (
    <article className="tool-page">
      <ToolHeader title="유니코드 · 한글 분석" description="문자의 코드포인트·UTF-8 바이트를 보고 한글을 자모로 분해합니다." />

      <div className="field">
        <span>분석할 텍스트</span>
        <textarea
          className="area"
          rows={3}
          value={input}
          onChange={(e) => update(e.target.value)}
          placeholder="문자를 입력하세요"
          spellCheck={false}
        />
      </div>

      {hangul.length > 0 && (
        <>
          <h2 className="sub-heading">한글 자모 분해</h2>

          <div className="kv-card">
            <div className="kv-row">
              <span className="kv-label">초성만<small className="muted block">초성 검색 만들 때</small></span>
              <span className="kv-value mono">{choseong}</span>
              <CopyButton value={() => choseong} label="복사" />
            </div>
            <div className="kv-row">
              <span className="kv-label">모음만<small className="muted block">중성만 모은 것</small></span>
              <span className="kv-value mono">{jungseong}</span>
              <CopyButton value={() => jungseong} label="복사" />
            </div>
            <div className="kv-row">
              <span className="kv-label">자모로 풀어쓰기<small className="muted block">한 → ㅎㅏㄴ</small></span>
              <span className="kv-value mono">{jamo}</span>
              <CopyButton value={() => jamo} label="복사" />
            </div>
          </div>

          {/* 칸마다 무엇인지 적는다 — 라벨이 없으면 "종성 없음"(—)이 자모처럼 읽힌다 */}
          <div className="jamo-row">
            {hangul.map((h, i) => (
              <div className="jamo-card" key={i}>
                <div className="jamo-char">{h.char}</div>
                <div className="jamo-parts">
                  <span><em>초</em>{h.cho}</span>
                  <span><em>중</em>{h.jung}</span>
                  <span className={h.jong ? "" : "none"}><em>종</em>{h.jong || "없음"}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="sub-heading">문자별 상세 ({chars.length}자)</h2>
      {chars.length === 0 ? (
        <div className="empty-state">텍스트를 입력하면 문자별 정보가 나옵니다.</div>
      ) : (
        <div className="table-wrap scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>문자</th><th>코드포인트</th><th>10진</th><th>UTF-8</th>
                <th>JS 이스케이프</th><th>HTML</th><th>URL</th><th>블록</th>
              </tr>
            </thead>
            <tbody>
              {chars.map((c, i) => (
                <tr key={i}>
                  <td className="char-cell">
                    {c.controlName ? <em className="muted">{c.controlName}</em> : c.char}
                  </td>
                  <td className="mono">{c.hex}</td>
                  <td className="mono">{c.decimal}</td>
                  <td className="mono">{c.utf8} <small className="muted">({c.utf8Length}B)</small></td>
                  <td className="mono">{c.jsEscape}</td>
                  <td className="mono">{c.htmlEntity}</td>
                  <td className="mono">{c.urlEncoded}</td>
                  <td className="muted">{c.block}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {inspectChars(input).length > 300 && <p className="hint">앞 300자만 표시합니다.</p>}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
