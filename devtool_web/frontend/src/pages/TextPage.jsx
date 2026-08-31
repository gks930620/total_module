// 텍스트 정리 — 넣는 것은 왼쪽, 나온 것은 오른쪽.
//
// 예전에는 버튼을 누르면 입력 칸을 그 자리에서 갈아치웠다. 되돌릴 방법이 없어서
// 잘못 누르면 붙여넣은 원본이 사라졌고, "지금 뭐가 걸려 있나" 도 화면에 안 남았다.
// 지금은 **원본을 건드리지 않고** 켜진 작업만 순서대로 적용해 오른쪽에 낸다.
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import {
  sortLines, trimLines, removeEmptyLines, numberLines,
  reverseLines, affixLines, wrapLines, textStats,
} from "../lib/textUtil.js";

const tool = getToolBySlug("text");

/** 줄 순서를 건드리는 것들 — 서로 겹칠 수 없어 하나만 고른다 */
const ORDER_OPS = [
  { key: "sort", label: "가나다순 정렬" },
  { key: "sortDesc", label: "역순 정렬" },
  { key: "reverse", label: "줄 순서 뒤집기" },
];

/** 서로 독립이라 여러 개를 같이 켤 수 있는 것들 */
const LINE_OPS = [
  { key: "trim", label: "양끝 공백 제거" },
  { key: "removeEmpty", label: "빈 줄 제거" },
  { key: "wrap", label: "80자로 줄바꿈" },
  { key: "number", label: "줄 번호 매기기" },
];

const GUIDE = {
  intro: "왼쪽에 텍스트를 붙여넣고 위에서 할 일을 켜면 오른쪽에 결과가 나옵니다. 원본은 건드리지 않으므로 껐다 켜며 비교할 수 있고, 여러 개를 같이 켜면 정해진 순서대로 이어서 적용됩니다.",
  screen: {
    layout: "split",
    left: { head: "원본", body: "정리할 텍스트를 붙여넣으세요" },
    right: { head: "결과 · 복사", body: "켜진 작업을 적용한 텍스트" },
    caption: "칩을 켜고 끄면 오른쪽만 바뀝니다. 왼쪽 원본은 그대로 남습니다.",
  },
  example: {
    in: `  banana
apple

cherry`,
    inLabel: "넣는 값 (양끝 공백 제거 + 빈 줄 제거 + 가나다순 정렬)",
    out: `apple
banana
cherry`,
  },
  notes: [
    "줄 순서를 바꾸는 세 가지(가나다순 · 역순 · 뒤집기)는 서로 겹칠 수 없어 하나만 켜집니다. 나머지는 여러 개를 같이 켤 수 있습니다.",
    "여러 개를 켜면 양끝 공백 제거 → 빈 줄 제거 → 정렬 → 80자로 줄바꿈 → 각 줄 감싸기 → 줄 번호 매기기 순서로 적용합니다. 번호는 다 끝난 뒤에 붙어야 최종 줄과 맞습니다.",
    "한글은 한국어 로케일(Intl.Collator) 기준 가나다순으로 정렬합니다. 유니코드 코드포인트 순서와 달라 사람이 기대하는 순서가 나옵니다.",
    "SQL IN 절에 넣을 목록은 '각 줄 감싸기' 에 앞 문자 ' 와 뒤 문자 ', 를 넣으면 됩니다.",
    "통계에서 '글자' 는 UTF-16 코드유닛 길이, '코드포인트' 는 이모지·서로게이트 쌍을 1로 센 값입니다. DB 컬럼 길이를 잴 때는 UTF-8 바이트를 보세요.",
  ],
};

export function TextPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [input, setInput] = useState("");
  const [orderOp, setOrderOp] = useState("");        // "" 면 순서를 안 건드린다
  const [on, setOn] = useState({});                  // { trim: true, ... }
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");

  const toggle = (key) => setOn((prev) => ({ ...prev, [key]: !prev[key] }));
  const pickOrder = (key) => setOrderOp((prev) => (prev === key ? "" : key));

  // 켜진 것만 정해진 순서로 이어 붙인다. 번호 매기기는 마지막이어야 최종 줄과 맞는다.
  const output = useMemo(() => {
    let t = input;
    if (!t) return "";
    if (on.trim) t = trimLines(t);
    if (on.removeEmpty) t = removeEmptyLines(t);
    if (orderOp === "sort") t = sortLines(t);
    else if (orderOp === "sortDesc") t = sortLines(t, { desc: true });
    else if (orderOp === "reverse") t = reverseLines(t);
    if (on.wrap) t = wrapLines(t, { width: 80 });
    if (prefix || suffix) t = affixLines(t, { prefix, suffix });
    if (on.number) t = numberLines(t);
    return t;
  }, [input, orderOp, on, prefix, suffix]);

  const before = useMemo(() => textStats(input), [input]);
  const after = useMemo(() => textStats(output), [output]);
  const active = Boolean(orderOp) || Object.values(on).some(Boolean) || Boolean(prefix || suffix);

  return (
    <article className="tool-page">
      <ToolHeader title="텍스트 정리" description="정렬·공백 정리·번호 매기기를 켜고 끄며 결과를 바로 봅니다." />

      <div className="chip-row" role="group" aria-label="줄 순서">
        {ORDER_OPS.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`chip ${orderOp === o.key ? "on" : ""}`}
            aria-pressed={orderOp === o.key}
            onClick={() => pickOrder(o.key)}
          >
            {o.label}
          </button>
        ))}
        {LINE_OPS.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`chip ${on[o.key] ? "on" : ""}`}
            aria-pressed={Boolean(on[o.key])}
            onClick={() => toggle(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="affix-row">
        <div className="field">
          <span>각 줄 앞에 붙일 문자</span>
          <input className="krw-input small" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="&apos;" />
        </div>
        <div className="field">
          <span>각 줄 뒤에 붙일 문자</span>
          <input className="krw-input small" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="&apos;," />
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => { setOrderOp(""); setOn({}); setPrefix(""); setSuffix(""); }}
          disabled={!active}
        >
          모두 끄기
        </button>
      </div>

      <div className="split">
        <section className="panel">
          <div className="panel-head tools">
            <span>원본</span>
            <div className="panel-tools">
              <button type="button" className="btn ghost" onClick={() => setInput("")} disabled={!input}>비우기</button>
            </div>
          </div>
          <textarea
            className="json-input mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="정리할 텍스트를 붙여넣으세요"
            spellCheck={false}
            aria-label="원본 텍스트"
          />
        </section>

        <section className="panel">
          <div className="panel-head tools">
            <span>결과{active ? "" : " (켠 작업 없음 — 원본 그대로)"}</span>
            <div className="panel-tools">
              {output && <CopyButton value={() => output} label="복사" />}
            </div>
          </div>
          {input === "" ? (
            <div className="panel-empty">왼쪽에 붙여넣고 위에서 할 일을 켜면 여기에 나옵니다.</div>
          ) : (
            <textarea
              className="json-input mono readonly"
              value={output}
              readOnly
              spellCheck={false}
              aria-label="정리한 텍스트"
            />
          )}
        </section>
      </div>

      {input !== "" && (
        <div className="statusbar">
          <span>줄 <b>{before.lines.toLocaleString("ko-KR")} → {after.lines.toLocaleString("ko-KR")}</b></span>
          <span>글자 <b>{before.chars.toLocaleString("ko-KR")} → {after.chars.toLocaleString("ko-KR")}</b></span>
          <span>단어 {after.words.toLocaleString("ko-KR")}</span>
          <span>공백 제외 {after.charsNoSpace.toLocaleString("ko-KR")}</span>
          <span>UTF-8 {after.bytes.toLocaleString("ko-KR")}바이트</span>
        </div>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
