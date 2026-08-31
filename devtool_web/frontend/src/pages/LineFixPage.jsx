// 줄바꿈 정리 — PDF·논문에서 복사하면 깨지는 문단 복구
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { joinBrokenLines, cleanupText, countDetail } from "../lib/textTools.js";

const tool = getToolBySlug("line-fix");

const SAMPLE = `이 연구는 대규모 언어 모델을 활용한
자연어 처리 기법의 실무 적용 가능성을
검토한다. 특히 한국어 문서에서의
성능을 중점적으로 다룬다.

다음 장에서는 실험 설계를 설명한다.`;

const GUIDE = {
  intro: "PDF·논문에서 복사하면 줄마다 뚝뚝 끊기는 문단을 원래대로 이어붙입니다. 문장이 끝나지 않은 줄 뒤의 개행만 공백으로 바꾸므로 문단 구분과 목록은 그대로 남습니다.",
  screen: {
    layout: "split",
    left: { head: "붙여넣기 · N줄", body: "PDF나 논문에서 복사한 텍스트" },
    right: { head: "정리 결과 · N줄", body: "결과 복사" },
    caption: "위 체크로 문단 유지 · 하이픈 제거 · 공백 정리를 끄고 켤 수 있습니다.",
  },
  example: {
    in: `이 연구는 대규모 언어 모델을 활용한
자연어 처리 기법의 실무 적용 가능성을
검토한다.

다음 장에서는 실험 설계를 설명한다.`,
    out: `이 연구는 대규모 언어 모델을 활용한 자연어 처리 기법의 실무 적용 가능성을 검토한다.

다음 장에서는 실험 설계를 설명한다.`,
  },
  notes: [
    "마침표·물음표 등으로 끝나지 않은 줄 뒤의 개행을 공백으로 바꿉니다. 빈 줄은 문단 구분으로 보고 그대로 둡니다.",
    "- · • · 1. 처럼 목록으로 보이는 줄은 이어붙이지 않습니다. 인용(>)과 마크다운 제목(#)도 건드리지 않습니다.",
    "영어가 'inter-' / 'national' 로 하이픈에서 끊긴 경우 하이픈을 지우고 붙입니다.",
    "한글은 줄바꿈이 대개 띄어쓰기 자리에서 일어나므로 공백을 넣어 잇고, 띄어쓰기를 쓰지 않는 한자·일본어는 공백 없이 붙입니다.",
  ],
};

export function LineFixPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [text, setText] = useState("");
  const [keepParagraphs, setKeepParagraphs] = useState(true);
  const [removeHyphen, setRemoveHyphen] = useState(true);
  const [collapseSpaces, setCollapseSpaces] = useState(true);
  const [normalizeQuotes, setNormalizeQuotes] = useState(false);

  const output = useMemo(() => {
    if (!text.trim()) return "";
    const joined = joinBrokenLines(text, { keepParagraphs, removeHyphen });
    return cleanupText(joined, { collapseSpaces, trimLines: true, normalizeQuotes });
  }, [text, keepParagraphs, removeHyphen, collapseSpaces, normalizeQuotes]);

  const before = useMemo(() => countDetail(text), [text]);
  const after = useMemo(() => countDetail(output), [output]);

  const onChange = (v) => {
    setText(v);
  };

  return (
    <article className="tool-page">
      <ToolHeader title="줄바꿈 정리" description="PDF·논문에서 복사하면 줄마다 끊기는 문단을 원래대로 이어붙입니다." />

      <div className="toolbar">
        <label className="check-inline"><input type="checkbox" checked={keepParagraphs} onChange={(e) => setKeepParagraphs(e.target.checked)} />문단(빈 줄) 유지</label>
        <label className="check-inline"><input type="checkbox" checked={removeHyphen} onChange={(e) => setRemoveHyphen(e.target.checked)} />영문 하이픈 복구</label>
        <label className="check-inline"><input type="checkbox" checked={collapseSpaces} onChange={(e) => setCollapseSpaces(e.target.checked)} />연속 공백 정리</label>
        <label className="check-inline"><input type="checkbox" checked={normalizeQuotes} onChange={(e) => setNormalizeQuotes(e.target.checked)} />따옴표 일반화</label>
        <div className="toolbar-right">
          <button type="button" className="btn" onClick={() => onChange(SAMPLE)}>예제 넣기</button>
          <button type="button" className="btn ghost" onClick={() => setText("")}>지우기</button>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head"><span>붙여넣기 · {before.lines}줄</span></div>
          <div style={{ padding: "16px 18px" }}>
            <textarea className="area code" rows={16} value={text} onChange={(e) => onChange(e.target.value)}
              placeholder="PDF나 논문에서 복사한 텍스트를 붙여넣으세요." spellCheck={false} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <span>정리 결과 · {after.lines}줄</span>
            {output && <CopyButton value={() => output} label="복사" />}
          </div>
          <div style={{ padding: "16px 18px" }}>
            <textarea className="area code readonly" rows={16} value={output} readOnly spellCheck={false} />
          </div>
        </div>
      </div>

      {text && (
        <div className="statusbar">
          <span>줄 <b>{before.lines} → {after.lines}</b></span>
          <span>글자 <b>{before.chars} → {after.chars}</b></span>
          <span>문단 <b>{after.paragraphs}</b></span>
        </div>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
