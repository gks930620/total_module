// SCR-06 정규식 테스터 (RGX-01~03, v1.1)
// 전부 클라이언트 처리(NFR-02). 패턴·문자열은 저장·전송하지 않는다(설계 04 §3 저장 금지 목록).
import { useEffect, useMemo, useRef, useState } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { buildSegments, REGEX_PRESETS } from "../lib/regexTester.js";
import { createRegexRunner } from "../lib/regexRunner.js";

const tool = getToolBySlug("regex");

/**
 * 플래그는 **g 고정**이다(전체 매치).
 *
 * 체크박스 5개를 두었더니 정작 대상 문자열에 대문자·줄바꿈·이모지가 없으면
 * 켜도 결과가 그대로여서, 고장난 것처럼 보이기만 했다.
 * 이 도구가 주는 값은 **한국에서 쓰는 5종 패턴을 바로 꺼내 쓰는 것**이고,
 * 그 밖의 조절이 필요한 사람은 패턴 자체에 쓴다([Hh]ello · [sS] 처럼).
 */
const FLAGS = "g";

const MAX_MATCHES = 1000;

const GUIDE = {
  intro: "위 칩에서 자주 쓰는 패턴을 고르면 패턴과 예시 문자열이 함께 채워집니다. 아래에 테스트 문자열을 붙여넣으면 매치된 부분을 글자 위에 바로 칠해 보여 주고, 캡처 그룹을 표로 풀어 줍니다.",
  screen: {
    layout: "stack",
    left: { head: "프리셋 5종 · 패턴", body: String.raw`01[016789]-?\d{3,4}-?\d{4}` },
    right: { head: "하이라이트 미리보기 → 매치 표", body: "매치마다 위치와 캡처 그룹" },
    caption: "패턴을 고치는 즉시 아래 하이라이트가 다시 칠해집니다.",
  },
  example: {
    in: String.raw`패턴  (\d{3})-(\d{4})
문자열  연락처는 010-1234-5678 입니다`,
    out: `매치 #1  123-4567
  그룹 1  123
  그룹 2  4567`,
  },
  notes: [
    String.raw`매치는 언제나 문자열 전체에서 찾습니다. 대소문자를 무시하려면 [Hh]ello 처럼, 줄바꿈까지 잡으려면 . 대신 [\s\S] 처럼 패턴 안에 직접 쓰면 됩니다.`,
    "휴대폰번호·이메일·사업자번호·우편번호·한글만 5종을 제공합니다. 누르면 패턴과 예시 문자열이 함께 채워지고, 켜진 것은 색으로 표시됩니다(패턴을 고치면 풀립니다).",
    "프리셋은 모두 문장에서 찾아내는 패턴입니다. '전체가 이 형식인가' 를 검사하려면 앞뒤에 ^ 와 $ 를 붙이세요 — [가-힣]+ 는 섞인 문장에서 한글만 뽑고, ^[가-힣]+$ 는 문자열 전체가 한글일 때만 통과시킵니다.",
    "[가-힣] 은 완성형 음절만입니다. ㅋㅋ · ㅎ 같은 자음 홑글자는 범위 밖이라 안 잡힙니다.",
    "치환(replace) 미리보기는 아직 없습니다 — 매치와 캡처 그룹 확인이 먼저입니다.",
    "매치는 브라우저의 정규식 엔진으로만 실행하며 패턴도 문자열도 저장·전송하지 않습니다.",
  ],
};

function MatchTable({ matches, truncated }) {
  return (
    <div className="regex-matches">
      <h3>
        매치 {matches.length}건
        {truncated && <span className="regex-truncated"> (상위 {MAX_MATCHES.toLocaleString()}개까지만 표시)</span>}
      </h3>
      <div className="regex-table-wrap">
        <table className="regex-table">
          <thead>
            <tr>
              <th>#</th>
              <th>매치 텍스트</th>
              <th>위치</th>
              <th>캡처 그룹</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.index}>
                <td>{m.index + 1}</td>
                <td className="regex-match-text">{m.text === "" ? "(빈 매치)" : m.text}</td>
                <td>
                  {m.start}–{m.end}
                </td>
                <td>
                  {m.groups.length === 0 && !m.namedGroups
                    ? "—"
                    : [
                        ...m.groups.map((g, i) => `$${i + 1}: ${g ?? "(없음)"}`),
                        ...(m.namedGroups
                          ? Object.entries(m.namedGroups).map(([k, v]) => `${k}: ${v ?? "(없음)"}`)
                          : []),
                      ].join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RegexPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [pattern, setPattern] = useState("");
  const [text, setText] = useState("");

  // 매칭은 워커에서 돈다. 폭주하는 패턴((a+)+ 같은)이 메인 스레드를 잡으면
  // 자바스크립트로는 멈출 방법이 없어 탭 전체가 얼어붙는다(실측 167초).
  const runnerRef = useRef(null);
  if (runnerRef.current == null) runnerRef.current = createRegexRunner();
  useEffect(() => () => runnerRef.current?.dispose(), []);

  const [result, setResult] = useState({ matches: [], error: null, truncated: false });

  // 어느 입력에 대한 결과인지 key 로 판별한다 — 효과 안에서 동기 setState 를 하지 않는다
  const runKey = pattern && text ? JSON.stringify([pattern, FLAGS, text]) : null;

  useEffect(() => {
    if (!runKey) return undefined;
    let alive = true;
    runnerRef.current.run(pattern, FLAGS, text).then((r) => {
      if (alive && !r.superseded) setResult({ key: runKey, ...r });
    });
    return () => { alive = false; };
  }, [runKey, pattern, text]);

  const shown = runKey && result.key === runKey ? result : { matches: [], error: null, truncated: false };
  const { matches, error, truncated } = shown;
  const busy = Boolean(runKey) && result.key !== runKey;

  const segments = useMemo(() => buildSegments(text, matches), [text, matches]);

  // 어느 프리셋이 켜져 있나 — 상태로 들고 있지 않고 지금 패턴에서 찾는다.
  // 손으로 패턴을 고치면 저절로 풀리고, 되돌려 놓으면 다시 켜진다.
  const activePreset = REGEX_PRESETS.find((p) => p.pattern === pattern)?.key ?? null;

  const applyPreset = (preset) => {
    setPattern(preset.pattern);
    setText(preset.sample);
  };

  return (
    <article className="tool-page">
      <ToolHeader
        title="정규식 테스터"
        description="자주 쓰는 패턴을 눌러 넣거나 직접 써서, 매치를 실시간 하이라이트하고 캡처 그룹을 표로 봅니다."
      />

      <div className="regex-presets" role="group" aria-label="한국 특화 프리셋">
        {REGEX_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`chip ${activePreset === p.key ? "on" : ""}`}
            aria-pressed={activePreset === p.key}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>패턴</span>
        <input
          className="regex-pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="예: 01[016789]-?\d{3,4}-?\d{4}"
          spellCheck={false}
        />
      </label>

      {busy && <div className="notice">계산 중입니다…</div>}
      {error && <div className="notice error">{error}</div>}

      <label className="field">
        <span>테스트 문자열</span>
        <textarea
          className="regex-text"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="매치를 확인할 문자열을 붙여넣으세요"
          spellCheck={false}
        />
      </label>

      {text && !error && (
        <>
          <h3>하이라이트 미리보기</h3>
          <pre className="regex-preview">
            {segments.map((s, i) =>
              s.matched ? (
                <mark key={i} title={`매치 #${s.matchIndex + 1}`}>
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              )
            )}
          </pre>
          {pattern && <MatchTable matches={matches} truncated={truncated} />}
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
