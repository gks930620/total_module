// 데이터 뷰어 — 붙여넣은 데이터를 트리·표·정렬된 원문으로 본다.
// /json 이 이 화면을 연다(검색어 "json 뷰어"·"json 포매터").
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { DataTree } from "../components/DataTree.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { detectFormat, INDENT } from "../lib/convert.js";
import { readData, flattenValue, toTableView, MAX_NODES, INPUT_FORMATS, SAMPLES } from "../lib/dataView.js";

const VIEWS = [
  { key: "tree", label: "트리" },
  { key: "table", label: "표" },
  { key: "text", label: "정렬된 원문" },
];

const GUIDE = {
  intro: "JSON·YAML·CSV·TSV·마크다운 표를 붙여넣으면 어떤 형식인지 알아서 알아보고 트리로 펼쳐 보여 줍니다. 트리에서 행을 누르면 그 값의 경로($.items[0].sku 꼴)가 복사되고, 표 모양 데이터는 '표' 탭에서 격자로 볼 수 있습니다.",
  screen: {
    layout: "split",
    left: { head: "형식 · 예시 넣기", body: "여기에 붙여넣기" },
    right: { head: "트리 · 표 · 정렬된 원문", body: "여기에서 보기" },
    caption: "왼쪽 칸에 붙여넣으면 오른쪽에 바로 나옵니다.",
  },
  example: {
    in: `{"items":[{"sku":"A-1","qty":2}],"ok":true}`,
    out: `▾ items  [1]
  ▾ 0  {2}
      sku : "A-1"
      qty : 2
  ok : true`,
    outLabel: "트리로 본 모습",
  },
  notes: [
    `트리에는 ${MAX_NODES.toLocaleString()}줄까지 눕힙니다. 넘으면 잘랐다고 알려 줍니다.`,
    "형식을 바꾸면 입력 칸을 비웁니다 — CSV 를 YAML 로 읽어 오류부터 뜨는 걸 막기 위해서입니다.",
    "형식을 바꿔 내보내려면 데이터 형식 변환 도구를 쓰세요.",
    "붙여넣은 내용은 브라우저 안에서만 읽습니다. 서버로 보내지 않습니다.",
  ],
};

export function ViewerPage({ meta }) {
  const m = meta || getToolBySlug("viewer");
  useMeta({ title: m.title, description: m.metaDescription, path: m.path, keywords: m.keywords });

  // 빈 칸으로 시작한다. 예시를 미리 넣어 두면 붙여넣기 전에 지워야 하고,
  // 남의 데이터가 이미 들어 있는 것처럼 보인다. 예시가 필요하면 버튼이 있다.
  const [input, setInput] = useState("");
  // 형식 칸에는 늘 진짜 형식이 들어 있다. "자동" 이라는 선택지를 두면
  // 그게 무슨 형식으로 읽힌다는 뜻인지 화면만 봐서는 알 수 없다.
  // 대신 붙여넣을 때 알아보고 이 값을 바꾼 뒤, 바꿨다는 사실을 알린다.
  const [format, setFormat] = useState("json");
  const [autoDetected, setAutoDetected] = useState(null);
  const [view, setView] = useState("tree");

  const onInput = (text) => {
    setInput(text);
    const guess = detectFormat(text);
    if (guess && guess !== format) {
      setFormat(guess);
      setAutoDetected(guess);
    } else {
      setAutoDetected(null);
    }
  };

  // 형식을 바꾸면 입력을 비운다. 남겨 두면 CSV 를 YAML 로 읽으라는 꼴이라
  // 대개 오류 문구부터 뜨는데, 그게 사용자가 방금 한 선택의 결과처럼 보인다.
  const pickFormat = (next) => {
    setFormat(next);
    setInput("");
    setAutoDetected(null);
  };

  // 예시는 지금 고른 형식의 것을 넣는다 — 무엇을 골라도 JSON 이 나오면 형식 선택이 무의미해 보인다
  const fillSample = () => {
    setInput(SAMPLES[format] || SAMPLES.json);
    setAutoDetected(null);
  };

  const parsed = useMemo(() => readData(input, format), [input, format]);
  const flat = useMemo(() => (parsed.ok ? flattenValue(parsed.value) : []), [parsed]);
  const table = useMemo(() => (parsed.ok ? toTableView(parsed.value) : { ok: false }), [parsed]);
  const text = useMemo(
    () => (parsed.ok ? JSON.stringify(parsed.value, null, INDENT) : ""),
    [parsed]
  );

  const label = (key) => INPUT_FORMATS.find((f) => f.key === key)?.label;
  const tableBlocked = parsed.ok && !table.ok;

  return (
    <article className="tool-page">
      <ToolHeader title="데이터 뷰어" />

      {autoDetected && (
        <div className="notice info">
          입력을 <b>{label(autoDetected)}</b> 로 알아봤습니다. 다르면 입력 칸의 <b>형식</b>에서 바꾸세요.
        </div>
      )}
      {!parsed.ok && input.trim() && <div className="notice error">{parsed.reason}</div>}
      {flat.truncated && (
        <div className="notice info">
          너무 커서 앞 {MAX_NODES.toLocaleString()}줄만 눕혔습니다. 아래에 더 있습니다.
        </div>
      )}

      <div className="split">
        {/* 입력을 다루는 것(형식·예시·비우기)은 입력 패널 안에 둔다 —
            화면 위에 다 모아 두면 어느 칸에 걸리는 설정인지 알 수 없다 */}
        <section className="panel">
          <div className="panel-head tools">
            <label className="select-label">
              형식
              <select value={format} onChange={(e) => pickFormat(e.target.value)}>
                {INPUT_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </label>
            <div className="panel-tools">
              <button type="button" className="btn" onClick={fillSample}>예시 넣기</button>
              <button type="button" className="btn ghost" onClick={() => { setInput(""); setAutoDetected(null); }}>비우기</button>
            </div>
          </div>
          <textarea
            className="json-input mono"
            value={input}
            onChange={(e) => onInput(e.target.value)}
            spellCheck={false}
            placeholder="JSON · YAML · CSV · TSV · 마크다운 표를 붙여넣으세요"
            aria-label="볼 데이터"
          />
        </section>

        {/* 보는 방식(트리·표·원문)과 그 방식의 설정(들여쓰기)은 출력 패널 안에 */}
        <section className="panel">
          <div className="panel-head tools">
            <div className="seg">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className={view === v.key ? "on" : ""}
                  onClick={() => setView(v.key)}
                  // 표로 못 보는 데이터에서 탭만 눌리고 아무 일도 없으면 고장난 것처럼 보인다
                  disabled={v.key === "table" && tableBlocked}
                  title={v.key === "table" && tableBlocked ? table.reason : undefined}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="panel-tools">
              {parsed.ok && view === "text" && <CopyButton value={() => text} label="복사" />}
            </div>
          </div>

          {!parsed.ok && <div className="panel-empty">읽을 수 있는 데이터를 넣으면 여기에 보여 줍니다.</div>}

          {parsed.ok && view === "tree" && <DataTree flat={flat} />}

          {parsed.ok && view === "table" && (table.ok ? (
            <div className="table-wrap scroll">
              <table className="data-table">
                <thead>
                  <tr>{table.header.map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((c, j) => (
                        <td key={j}>{c === null ? <span className="muted">NULL</span> : String(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-empty">{table.reason}</div>
          ))}

          {parsed.ok && view === "text" && (
            <textarea className="json-input mono readonly" value={text} readOnly spellCheck={false} aria-label="정렬된 원문" />
          )}
        </section>
      </div>

      <ToolGuide {...GUIDE} />
    </article>
  );
}
