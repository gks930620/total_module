// 타임스탬프 변환 도구
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import {
  parseAnyToMs, detectUnit, formatIso, formatKst, formatUtc, toRelativeKo, breakdown,
} from "../lib/timestamp.js";

const tool = getToolBySlug("timestamp");

const GUIDE = {
  intro: "유닉스 타임스탬프를 넣으면 KST·UTC·ISO-8601 로 한꺼번에 바꾸고, 지금으로부터 얼마나 떨어진 시각인지도 알려 줍니다. 반대로 날짜 문자열을 넣으면 타임스탬프를 계산합니다 — 같은 칸에 무엇을 넣어도 됩니다.",
  screen: {
    layout: "stack",
    left: { head: "타임스탬프 또는 날짜 문자열", body: "1735689600 또는 2025-01-01T00:00:00Z" },
    right: { head: "KST · UTC · ISO · 상대 시간 · 연월일 분해", body: "줄마다 복사 버튼" },
    caption: "숫자를 넣으면 날짜가, 날짜를 넣으면 숫자가 나옵니다.",
  },
  example: {
    in: "1735689600",
    out: `KST   2025-01-01 09:00:00 (KST)
UTC   2025-01-01 00:00:00 (UTC)
ISO   2025-01-01T00:00:00.000Z`,
  },
  notes: [
    "초와 밀리초는 자릿수로 구분합니다 — 10자리 이하는 초, 13자리는 밀리초, 16자리는 마이크로초, 19자리는 나노초.",
    "KST 는 브라우저 타임존과 무관하게 +09:00 고정으로 계산합니다. 해외에서 접속해도 같은 값이 나옵니다.",
    "기본을 KST 로 둔 것은 한국 개발자가 서버 로그·DB 값을 확인하는 상황을 기준으로 만들었기 때문입니다. UTC·ISO 도 함께 나오니 필요한 값을 바로 복사하면 됩니다.",
  ],
};

function Row({ label, value, mono = true }) {
  return (
    <div className="kv-row">
      <span className="kv-label">{label}</span>
      <span className={`kv-value ${mono ? "mono" : ""}`}>{value}</span>
      <CopyButton value={() => String(value)} label="복사" />
    </div>
  );
}

export function TimestampPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [input, setInput] = useState(() => String(Date.now()));
  // '상대 시간' 의 기준점. 렌더 중에는 Date.now() 를 못 부르므로(React Compiler 규칙)
  // 값이 바뀌는 순간에만 다시 잰다 — 어차피 그때 말고는 다시 잴 이유가 없다.
  const [now, setNow] = useState(() => Date.now());

  const onInput = (v) => {
    setInput(v);
    setNow(Date.now());
  };

  const ms = useMemo(() => parseAnyToMs(input), [input]);
  const unit = useMemo(() => detectUnit(input), [input]);
  const relative = useMemo(() => toRelativeKo(ms, now), [ms, now]);

  const UNIT_LABEL = { s: "초(10자리)", ms: "밀리초(13자리)", us: "마이크로초", ns: "나노초" };

  return (
    <article className="tool-page">
      <ToolHeader title="타임스탬프 변환" description="유닉스 타임스탬프와 날짜를 KST·UTC 기준으로 서로 변환합니다." />

      <div className="field">
        <span>타임스탬프 또는 날짜 문자열</span>
        <input
          className="krw-input"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="1735689600 또는 2025-01-01T00:00:00Z"
          spellCheck={false}
        />
      </div>

      {unit && <p className="hint">입력을 <b>{UNIT_LABEL[unit]}</b> 단위로 해석했습니다.</p>}

      {input.trim() === "" && <div className="empty-state">값을 입력하면 변환 결과가 나옵니다.</div>}

      {input.trim() !== "" && ms === null && (
        <div className="notice error">
          해석할 수 없는 값입니다. 숫자(epoch) 또는 ISO-8601 날짜 문자열을 넣어 주세요.
        </div>
      )}

      {ms !== null && (
        <>
          <div className="kv-card">
            <Row label="한국 시간 (KST)" value={formatKst(ms)} />
            <Row label="협정 세계시 (UTC)" value={formatUtc(ms)} />
            <Row label="ISO-8601" value={formatIso(ms)} />
            <Row label="epoch 초" value={Math.floor(ms / 1000)} />
            <Row label="epoch 밀리초" value={ms} />
            <Row label="상대 시간" value={relative} mono={false} />
          </div>

          {(() => {
            const b = breakdown(ms);
            return (
              <div className="kv-card">
                <div className="kv-row"><span className="kv-label">요일 (KST)</span><span className="kv-value">{b.kstWeekday}요일</span></div>
                <div className="kv-row"><span className="kv-label">연중 일자</span><span className="kv-value">{b.kstYear}년의 {b.dayOfYear}일째</span></div>
                <div className="kv-row"><span className="kv-label">분해</span><span className="kv-value mono">{b.kstYear}년 {b.kstMonth}월 {b.kstDay}일 {b.kstHour}시 {b.kstMinute}분 {b.kstSecond}초</span></div>
              </div>
            );
          })()}
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
