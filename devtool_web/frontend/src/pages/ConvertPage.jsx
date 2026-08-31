// 데이터 형식 변환 — JSON·YAML·CSV·TSV·마크다운 표를 읽어 원하는 형식으로 내보낸다.
// /yaml · /csv · /json-to-type 세 URL 이 시작 형식만 다르게 이 화면을 공유한다.
import { useState } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { INPUT_FORMATS, OUTPUT_FORMATS, convert, detectFormat, INDENT } from "../lib/convert.js";
import { SQL_DIALECTS } from "../lib/sqlDialect.js";

const SAMPLES = {
  json: '[\n  { "id": 1, "name": "김철수", "dept": "개발팀" },\n  { "id": 2, "name": "이영희", "dept": "기획팀" }\n]',
  yaml: "- id: 1\n  name: 김철수\n  dept: 개발팀\n- id: 2\n  name: 이영희\n  dept: 기획팀",
  csv: "id,name,dept\n1,김철수,개발팀\n2,이영희,기획팀",
  tsv: "id\tname\tdept\n1\t김철수\t개발팀\n2\t이영희\t기획팀",
  markdown: "| id | name   | dept   |\n| -- | ------ | ------ |\n| 1  | 김철수 | 개발팀 |\n| 2  | 이영희 | 기획팀 |",
};

/**
 * 만들어 낼 테이블·타입의 이름.
 *
 * <p>입력칸으로 받지 않는다. 붙여넣고 복사해 가는 도구라 이름은 붙여넣은 자리에서
 * 고치는 편이 빠르고(에디터의 이름 바꾸기가 훨씬 낫다), 칸 두 개가 도구 막대를
 * 차지하면서 정작 자주 쓰는 형식 선택을 밀어냈다.
 */
const TABLE_NAME = "sample";
const ROOT_TYPE_NAME = "Root";

const GUIDE = {
  intro: "왼쪽에 붙여넣고 오른쪽에서 형식을 고르면 바뀝니다. 읽기는 JSON·YAML·CSV·TSV·마크다운 표 다섯 가지, 내보내기는 거기에 SQL INSERT 와 타입 코드(TypeScript·Java·Kotlin)를 더해 아홉 가지라 CSV 를 YAML 로, 마크다운 표를 DTO 로 바꾸는 것도 됩니다.",
  screen: {
    layout: "split",
    left: { head: "입력 형식 · 예시 넣기", body: "여기에 붙여넣기" },
    right: { head: "출력 형식 · 복사", body: "바뀐 결과 · 파일로 저장" },
    caption: "가운데 ⇄ 를 누르면 입력과 출력을 맞바꿉니다(SQL·타입 코드는 입력으로 못 씁니다).",
  },
  example: {
    in: `id,name,dept
1,김철수,개발팀
2,이영희,기획팀`,
    inLabel: "넣는 값 (CSV)",
    out: `- id: 1
  name: 김철수
  dept: 개발팀
- id: 2
  name: 이영희
  dept: 기획팀`,
    outLabel: "나오는 값 (YAML)",
  },
  notes: [
    "입력 형식은 붙여넣으면 알아서 알아봅니다 — 중괄호로 시작하면 JSON, 파이프로 시작하는 표는 마크다운, 줄마다 칸 수가 같으면 CSV/TSV, 'key: value' 꼴이면 YAML. 틀리면 직접 고르면 됩니다.",
    "CSV·TSV·마크다운 표·SQL 은 표 모양이 필요합니다. 값 하나만 있으면 표로 못 만든다고 알려 주고, 중첩된 값은 JSON 문자열로 눕혀 한 칸에 담습니다(어느 열인지 알려 줍니다).",
    "타입 코드에서 자바는 record 가 아니라 class + Lombok 으로 냅니다. 필드명은 camelCase 로 바꾸고 원본 키와 다르면 @JsonProperty 를 붙입니다.",
    "YAML 은 매핑·시퀀스·중첩·인용·flow 표기·주석·문서 구분자(---)·블록 스칼라(| >)까지 읽습니다. 앵커/별칭(& *)·태그(!!)·복합 키는 지원하지 않습니다.",
    "엑셀에서 만든 CSV 의 한글이 깨지면 CP949 로 저장된 것입니다. 'CSV UTF-8' 로 다시 저장한 뒤 붙여넣으세요.",
    "전부 브라우저 안에서 변환하며 서버로 아무것도 보내지 않습니다.",
  ],
};

/**
 * @param {object} props
 * @param {string} props.from 시작 입력 형식
 * @param {string} props.to 시작 출력 형식
 * @param {object} props.meta 이 URL 의 SEO 메타(검색어가 URL 마다 달라 각각 유지한다)
 */
export function ConvertPage({ from = "json", to = "yaml", meta }) {
  useMeta({ title: meta.title, description: meta.metaDescription, path: meta.path, keywords: meta.keywords });

  // 빈 칸으로 시작한다. 예시를 미리 넣어 두면 붙여넣기 전에 지워야 하고,
  // 남의 데이터가 이미 들어 있는 것처럼 보인다. 예시가 필요하면 버튼이 있다.
  const [input, setInput] = useState("");
  const [fromFormat, setFromFormat] = useState(from);
  const [toFormat, setToFormat] = useState(to);
  const [dialect, setDialect] = useState("mysql");
  const [autoDetected, setAutoDetected] = useState(null);

  const onInput = (text) => {
    setInput(text);
    const guess = detectFormat(text);
    if (guess && guess !== fromFormat) {
      setFromFormat(guess);
      setAutoDetected(guess);
    } else {
      setAutoDetected(null);
    }
  };

  // 입력 형식을 바꾸면 입력을 비운다. 남겨 두면 CSV 를 YAML 로 읽으라는 꼴이라
  // 대개 오류 문구부터 뜨는데, 그게 사용자가 방금 한 선택의 결과처럼 보인다.
  // (출력 형식은 비우지 않는다 — 같은 입력을 다르게 내보내려고 바꾸는 것이다)
  const pickFromFormat = (next) => {
    setFromFormat(next);
    setInput("");
    setAutoDetected(null);
  };

  const swap = () => {
    // 내보내기 전용 형식(SQL·타입 코드)은 입력으로 쓸 수 없다
    if (!INPUT_FORMATS.some((f) => f.key === toFormat)) return;
    const result = convert(input, fromFormat, toFormat, { indent: INDENT, table: TABLE_NAME, rootName: ROOT_TYPE_NAME, dialect });
    setFromFormat(toFormat);
    setToFormat(fromFormat);
    if (result.ok) setInput(result.text);
    setAutoDetected(null);
  };

  const result = convert(input, fromFormat, toFormat, { indent: INDENT, table: TABLE_NAME, rootName: ROOT_TYPE_NAME, dialect });
  const isCode = ["ts", "java", "record", "kotlin"].includes(toFormat);
  const canSwap = INPUT_FORMATS.some((f) => f.key === toFormat);

  const download = () => {
    const ext = { json: "json", yaml: "yaml", csv: "csv", tsv: "tsv", markdown: "md", sql: "sql", ts: "ts", java: "java", record: "java", kotlin: "kt" }[toFormat] || "txt";
    const name = isCode ? `${ROOT_TYPE_NAME}.${ext}` : `data.${ext}`;
    const blob = new Blob([result.text || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="tool-page">
      <ToolHeader title="데이터 형식 변환" description="JSON·YAML·CSV·마크다운 표를 서로 바꾸고, SQL·타입 코드로 내보냅니다." />

      {/* 중첩을 JSON 문자열로 눌러 담았으면 어느 열인지 알린다 — 조용히 하면 모른다 */}
      {result.notes?.map((note) => (
        <div className="notice info" key={note}>{note}</div>
      ))}

      {autoDetected && (
        <div className="notice info">
          입력을 <b>{INPUT_FORMATS.find((f) => f.key === autoDetected)?.label}</b> 로 알아봤습니다. 다르면 입력 칸에서 바꾸세요.
        </div>
      )}

      <div className="split with-swap">
        {/* 입력에 걸리는 것(형식·예시·비우기)은 입력 패널 안에,
            출력에 걸리는 것(형식·형식별 옵션·복사)은 출력 패널 안에 둔다.
            위에 한 줄로 모아 두면 어느 칸의 설정인지 알 수 없다. */}
        <section className="panel">
          <div className="panel-head tools">
            <label className="select-label">
              입력
              <select value={fromFormat} onChange={(e) => pickFromFormat(e.target.value)}>
                {INPUT_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </label>
            <div className="panel-tools">
              <button type="button" className="btn" onClick={() => setInput(SAMPLES[fromFormat] || "")}>예시 넣기</button>
              <button type="button" className="btn ghost" onClick={() => { setInput(""); setAutoDetected(null); }}>비우기</button>
            </div>
          </div>
          <textarea
            className="json-input mono"
            value={input}
            onChange={(e) => onInput(e.target.value)}
            spellCheck={false}
            placeholder="여기에 붙여넣으면 형식을 자동으로 알아봅니다"
            aria-label="변환할 데이터"
          />
        </section>

        {/* 두 패널을 맞바꾸는 버튼이라 두 패널 사이에 둔다 */}
        <div className="swap-slot">
          <button
            type="button"
            className="btn icon"
            onClick={swap}
            disabled={!canSwap}
            title={canSwap ? "입력과 출력을 바꾼다" : "SQL·타입 코드는 입력으로 쓸 수 없습니다"}
            aria-label="입력과 출력 바꾸기"
          >
            ⇄
          </button>
        </div>

        <section className="panel">
          <div className="panel-head tools">
            <label className="select-label">
              출력
              <select value={toFormat} onChange={(e) => setToFormat(e.target.value)}>
                {OUTPUT_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </label>

            <div className="panel-tools">
              {/* 출력 형식별 옵션만 보여준다 */}
              {/* DB 는 남긴다 — 이름과 달리 식별자 인용·불리언 표기가 방언마다 달라서
                  나중에 손으로 고치기 어렵다(예약어 컬럼은 인용 없이는 아예 안 돈다) */}
              {toFormat === "sql" && (
                <label className="select-label">
                  DB
                  <select value={dialect} onChange={(e) => setDialect(e.target.value)}>
                    {SQL_DIALECTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </label>
              )}
              {result.ok && result.text && <CopyButton value={() => result.text} label="복사" />}
            </div>
          </div>
          {result.ok ? (
            <textarea className="json-input mono readonly" value={result.text} readOnly spellCheck={false} aria-label="변환 결과" />
          ) : (
            <div className="notice error" style={{ margin: "16px 18px" }}>{result.reason}</div>
          )}
        </section>
      </div>

      {result.ok && result.text && (
        <div className="statusbar">
          <span>{(new Blob([result.text]).size / 1024).toFixed(1)}KB</span>
          <span>{result.text.split("\n").length}줄</span>
          {result.typeCount != null && <span>타입 <b>{result.typeCount}</b>개</span>}
          <div className="toolbar-right">
            <button type="button" className="btn" onClick={download}>파일로 저장</button>
          </div>
        </div>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
