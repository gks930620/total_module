// cron 표현식 해석기
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { parseCron, describeCron, nextRuns, explainCronToken, CRON_PRESETS } from "../lib/cron.js";

const tool = getToolBySlug("cron");

const GUIDE = {
  intro: "cron 표현식을 넣으면 한국어 한 문장으로 풀이하고, 필드마다 어떤 값에 걸리는지 펼쳐 보여 준 뒤, 앞으로 실제 언제 도는지 시각 목록을 만들어 줍니다. 표현식이 의도대로 걸리는지는 결국 실행 시각을 봐야 압니다.",
  screen: {
    layout: "stack",
    left: { head: "cron 표현식 (5필드 또는 6필드)", body: "0 9 * * 1-5 · 자주 쓰는 것은 위 칩으로" },
    right: { head: "해석 한 줄 → 필드별 전개 → 다음 실행 시각", body: "목록 개수 선택 · 목록 복사" },
    caption: "위에 적으면 아래 해석과 실행 시각이 바로 바뀝니다.",
  },
  example: {
    in: "0 9 * * 1-5",
    out: `해석    월~금요일 09:00에 실행 (KST 기준)
필드    분 0 → "0분" · 시 9 → "9시" · 요일 1-5 → "월요일~금요일"
목록    앞으로 도는 시각을 KST 로 5~50개까지`,
  },
  notes: [
    "표준 crontab 은 '분 시 일 월 요일' 5필드이고, 스프링 @Scheduled·Quartz 는 맨 앞에 초를 더한 6필드입니다. 둘 다 자동으로 알아봅니다.",
    "다음 실행 시각은 KST(+09:00) 고정입니다. 서버 타임존이 UTC 면 실제 실행은 9시간 차이가 납니다.",
    "일과 요일을 동시에 지정하면 cron 관례대로 OR 입니다 — '0 0 1 * 1' 은 매월 1일 '또는' 매주 월요일입니다.",
    "* ? 숫자, 범위(1-5), 목록(1,3,5), 간격(*/15 · 10-20/5), 이름(MON · JAN), @daily·@hourly 별칭을 읽습니다.",
    "'필드별 전개' 표는 각 칸에 쓴 기호가 무슨 뜻인지 풀어 줍니다 — */30 은 '30분마다', 9-18 은 '9시~18시', ? 는 '지정 안 함'. 실제로 언제 도는지는 그 아래 실행 시각 목록을 보면 됩니다.",
    "1년 안에 도는 시각이 없으면 조건이 모순이라는 뜻입니다(예: 2월 30일).",
  ],
};

const FIELD_LABELS = [
  ["second", "초", "0-59"],
  ["minute", "분", "0-59"],
  ["hour", "시", "0-23"],
  ["dayOfMonth", "일", "1-31"],
  ["month", "월", "1-12"],
  ["dayOfWeek", "요일", "0-6 (0=일)"],
];

export function CronPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [expr, setExpr] = useState("0 9 * * 1-5");
  const [count, setCount] = useState(10);

  const parsed = useMemo(() => parseCron(expr), [expr]);
  const description = useMemo(() => describeCron(expr), [expr]);
  const runs = useMemo(() => nextRuns(expr, { count }), [expr, count]);

  // 어느 프리셋이 켜져 있나 — 지금 표현식에서 찾는다. 별도 상태가 없으니 어긋날 수 없다.
  const norm = (v) => v.trim().replace(/\s+/g, " ");
  const activePreset = CRON_PRESETS.find((p) => norm(p.expr) === norm(expr))?.expr ?? null;

  const apply = (value) => {
    setExpr(value); };

  return (
    <article className="tool-page">
      <ToolHeader title="cron 표현식 해석기" description="cron 표현식을 한국어로 풀이하고 다음 실행 시각을 보여줍니다." />

      <div className="chip-row" role="group" aria-label="자주 쓰는 표현식">
        {CRON_PRESETS.map((p) => (
          <button
            key={p.expr}
            type="button"
            className={`chip ${activePreset === p.expr ? "on" : ""}`}
            aria-pressed={activePreset === p.expr}
            onClick={() => apply(p.expr)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="field">
        <span>cron 표현식 (5필드 또는 6필드)</span>
        <input
          className="krw-input"
          value={expr}
          onChange={(e) => apply(e.target.value)}
          placeholder="0 30 2 * * 1-5"
          spellCheck={false}
        />
      </div>

      {parsed.ok ? (
        <div className="notice ok">
          <strong>해석</strong> — {description}
          {parsed.hasSeconds && <span className="tag">6필드(초 포함)</span>}
        </div>
      ) : (
        <div className="notice error"><strong>오류</strong> — {parsed.error}</div>
      )}

      {parsed.ok && (
        <>
          <h2 className="sub-heading">필드별 전개</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>필드</th><th>입력</th><th>뜻</th><th>허용 범위</th></tr></thead>
              <tbody>
                {FIELD_LABELS.map(([key, label, range]) => {
                  const token = parsed.tokens[key];
                  if (key === "second" && !parsed.hasSeconds) return null;
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td className="mono">{token}</td>
                      <td>{explainCronToken(token, key)}</td>
                      <td className="muted">{range}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h2 className="sub-heading">
            다음 실행 시각 (KST)
            <label className="select-label inline">
              개수
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {runs.length > 0 && <CopyButton value={() => runs.map((r) => r.kst).join("\n")} label="목록 복사" />}
          </h2>

          {runs.length === 0 ? (
            <div className="notice warn">앞으로 1년 안에 실행되는 시각을 찾지 못했습니다. 조건이 서로 모순되는지 확인해 주세요(예: 2월 30일).</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>#</th><th>실행 시각</th><th>요일</th><th>남은 시간</th></tr></thead>
                <tbody>
                  {runs.map((r, i) => (
                    <tr key={r.ms}>
                      <td className="num">{i + 1}</td>
                      <td className="mono">{r.kst}</td>
                      <td>{r.weekday}</td>
                      <td className="muted">{formatAfter(r.afterSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}

function formatAfter(seconds) {
  if (seconds < 60) return `${seconds}초 후`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 후`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 후`;
  return `${Math.floor(seconds / 86400)}일 후`;
}
