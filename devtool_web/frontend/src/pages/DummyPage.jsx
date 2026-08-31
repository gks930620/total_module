// DB 더미데이터 생성기 — DB 를 고르고, 그 DB 의 데이터타입으로 컬럼을 정의한다
import { useState } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import {
  SQL_DIALECTS, DB_TYPES, MAX_ROWS,
  getDbType, renderType, createField, generateRows,
  toCsv, toJson, toInsertSql, toCreateTable, parseSchema, sortRows,
} from "../lib/dummy.js";

const tool = getToolBySlug("dummy");

const GUIDE = {
  intro: "DB 를 고르고 컬럼을 정의하면 그 DB 방언에 맞는 INSERT 문·CSV·JSON 을 만들어 줍니다. 컬럼을 일일이 적을 필요 없이 'SQL 에서 컬럼 가져오기' 에 CREATE TABLE 문을 붙여넣으면 컬럼명·타입·길이·NOT NULL·주석을 읽어 정의를 채웁니다.",
  screen: {
    layout: "stack",
    left: { head: "DB 선택 · SQL 에서 컬럼 가져오기 · 컬럼 정의", body: "컬럼마다 이름 · 타입 · 길이 · NULL % · 비고" },
    right: { head: "결과 (INSERT · CSV · JSON)", body: "형식 선택 · 복사 · 파일로 저장" },
    caption: "컬럼을 정하고 건수를 넣으면 아래에 결과가 만들어집니다.",
  },
  example: {
    in: `CREATE TABLE member (
  id BIGINT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(20)
);`,
    inLabel: "넣는 값 (SQL 에서 컬럼 가져오기)",
    out: `INSERT INTO "member" ("id", "email", "name") VALUES
(1, 'user1@example.com', '김민준'),
(2, 'user2@example.com', '이서연');`,
    outLabel: "나오는 값 (PostgreSQL)",
  },
  notes: [
    "INSERT 문만 있어도 컬럼명을 읽고 값에서 타입을 추론합니다. PRIMARY KEY·INDEX 같은 제약조건 줄은 건너뜁니다.",
    "붙여넣은 SQL 의 DB 도 알아봅니다(VARCHAR2·NUMBER 면 오라클, JSONB·SERIAL 이면 PostgreSQL, NVARCHAR·DATETIME2 면 SQL Server, 백틱·AUTO_INCREMENT 면 MySQL). 다만 가져올 때는 화면에서 고른 DB 의 타입으로 옮기니 원하는 DB 를 먼저 고르세요.",
    "DB 를 바꾸면 그 DB 에 실제로 있는 타입만 보여 주고 컬럼 타입은 새 DB 의 기본 타입으로 초기화됩니다. 식별자 따옴표·불리언 표기·오라클의 TO_DATE 까지 방언에 맞춥니다.",
    "VARCHAR(20) 에 들어가는 한글은 DB 마다 다릅니다 — MySQL·PostgreSQL 은 20자, 오라클 VARCHAR2 와 SQL Server VARCHAR 는 20바이트라 6자입니다. 이 도구는 DB 에 맞춰 안전한 길이로 만들어 INSERT 가 길이 초과로 실패하지 않습니다.",
    "컬럼마다 NULL % 를 주면 그 비율만큼 비웁니다. 0 이면 CREATE TABLE 에 NOT NULL 이 붙고, 0 보다 크면 붙지 않습니다.",
    "'비고' 는 사람이 알아보라고 적는 메모입니다. 값 생성에는 영향이 없고 'CREATE TABLE 포함' 을 켜면 컬럼 주석으로 들어갑니다.",
    "CSV 를 엑셀에서 열 때 한글이 깨지면 'BOM 붙이기' 를 켜세요 — 엑셀은 BOM 이 없으면 UTF-8 파일을 CP949 로 읽습니다.",
    `한 번에 ${MAX_ROWS}건까지 만듭니다. 성능 한계가 아니라 실수로 거대한 파일을 만들지 않게 둔 상한입니다.`,
    "전부 브라우저에서 생성하며 서버로 아무것도 보내지 않습니다.",
  ],
};

const FORMATS = [
  { key: "table", label: "표" },
  { key: "sql", label: "SQL" },
  { key: "csv", label: "CSV" },
  { key: "json", label: "JSON" },
];

let seq = 0;
const withId = (f) => ({ ...f, uid: `f${++seq}` });

/** 빈 컬럼 한 줄 — 처음 열었을 때와 DB 를 바꿨을 때의 시작 상태 */
const emptyField = (dialect) => withId(createField(dialect, DB_TYPES[dialect][0].key, ""));

/** 가져오기 결과에 보여 줄 소스 이름 — lib/dummy.js 의 판별 결과와 짝이다 */
const SOURCE_LABELS = {
  sql: "SQL", java: "자바 엔티티", kotlin: "코틀린 엔티티",
  ts: "TypeScript 타입", json: "JSON", csv: "CSV",
};

/** 예시 — 타입·길이·NOT NULL·주석이 모두 들어 있어 가져오기 결과를 한 번에 볼 수 있다 */
const SAMPLE_SQL = [
  "CREATE TABLE member (",
  "  id BIGINT NOT NULL COMMENT '회원 번호',",
  "  login_id VARCHAR(30) NOT NULL COMMENT '로그인 아이디',",
  "  email VARCHAR(255) NOT NULL,",
  "  age INT,",
  "  created_at DATETIME NOT NULL,",
  "  PRIMARY KEY (id)",
  ");",
].join("\n");

const IMPORT_PLACEHOLDER = [
  "CREATE TABLE users (",
  "  id BIGINT NOT NULL COMMENT '회원 번호',",
  "  email VARCHAR(255) NOT NULL",
  ");",
  "",
  "@Entity",
  "public class Member {",
  "    @Id private Long id;",
  "    @Column(length = 30, nullable = false) private String loginId;",
  "    private LocalDateTime createdAt;",
  "}",
  "",
  'INSERT INTO users (id, email) VALUES (1, \'a@b.c\');',
  '[{ "id": 1, "email": "a@b.c" }]',
  "id,email",
].join("\n");

export function DummyPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [dialect, setDialect] = useState("mysql");
  // 빈 컬럼 3줄로 시작한다. 예시 스키마를 깔면 사용자가 정의한 것처럼 보이고,
  // 한 줄만 두면 "여기에 뭘 하라는 건지" 를 글로 설명해야 한다. 빈 줄이 곧 설명이다.
  const [fields, setFields] = useState(() => [emptyField("mysql"), emptyField("mysql"), emptyField("mysql")]);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [sqlInput, setSqlInput] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [tableName, setTableName] = useState("sample");
  const [count, setCount] = useState(10);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [format, setFormat] = useState("table");
  const [batch, setBatch] = useState(true);
  const [withDdl, setWithDdl] = useState(true);
  const [header, setHeader] = useState(true);
  const [lineEnding, setLineEnding] = useState("lf");
  const [bom, setBom] = useState(false);
  // 끌어서 순서 변경: 손잡이를 누르는 동안에만 행이 draggable 이 된다
  // (행 전체를 항상 draggable 로 두면 입력칸에서 텍스트를 못 고른다)
  const [handleArmed, setHandleArmed] = useState(false);
  const [dragUid, setDragUid] = useState(null);
  const [overUid, setOverUid] = useState(null);
  const [rows, setRows] = useState([]);

  const types = DB_TYPES[dialect] || [];

  const patch = (uid, changes) =>
    setFields((prev) => prev.map((f) => (f.uid === uid ? { ...f, ...changes } : f)));

  const changeType = (uid, typeKey) =>
    setFields((prev) => prev.map((f) => {
      if (f.uid !== uid) return f;
      const base = createField(dialect, typeKey, f.name);
      return { ...base, note: f.note, nullPercent: f.nullPercent, uid: f.uid };
    }));

  const addField = () => setFields((prev) => [...prev, withId(createField(dialect, types[0]?.key, ""))]);
  const removeField = (uid) => setFields((prev) => prev.filter((f) => f.uid !== uid));

  /** 한 칸 이동 — 손잡이에 포커스를 두고 화살표 키로 옮길 때 쓴다(키보드 접근성) */
  const move = (uid, dir) =>
    setFields((prev) => {
      const i = prev.findIndex((f) => f.uid === uid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /** 끌어서 놓은 자리로 옮긴다(자리 바꾸기가 아니라 끼워넣기) */
  const reorder = (fromUid, toUid) => {
    if (!fromUid || fromUid === toUid) return;
    setFields((prev) => {
      const from = prev.findIndex((f) => f.uid === fromUid);
      const to = prev.findIndex((f) => f.uid === toUid);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const endDrag = () => {
    setDragUid(null);
    setOverUid(null);
    setHandleArmed(false);
  };

  // 잃을 게 있나 — 빈 한 줄뿐이면 확인 없이 넘어간다
  const hasContent = fields.length > 1 || fields.some((f) => f.name.trim() !== "");

  /**
   * DB 를 바꾸면 컬럼 정의를 **초기화**한다.
   * 데이터타입은 DB 마다 다르므로 억지로 옮기면 의도하지 않은 타입이 섞인다 —
   * 새 DB 기준으로 처음부터 정의하게 하는 편이 정확하다.
   */
  const changeDialect = (next) => {
    if (next === dialect) return;
    if (hasContent && !window.confirm(
      "데이터타입은 DB 마다 다릅니다. DB 를 바꾸면 컬럼 정의가 초기화됩니다.\n계속할까요?"
    )) return;

    setDialect(next);
    setFields([emptyField(next), emptyField(next), emptyField(next)]);
    setRows([]);
    setImportResult(null);
  };

  /** 붙여넣은 스키마(SQL·엔티티 클래스·JSON·CSV)로 컬럼 정의를 채운다 */
  const importSql = () => {
    const parsed = parseSchema(sqlInput, dialect);
    if (!parsed.ok) {
      setImportResult({ error: parsed.reason });
      return;
    }
    if (hasContent && !window.confirm(
      `지금 정의한 컬럼 ${fields.length}개를 버리고 읽어온 ${parsed.fields.length}개로 바꿉니다.\n계속할까요?`
    )) return;

    setFields(parsed.fields.map(withId));
    setTableName(parsed.table);
    setRows([]);
    setImportResult({
      table: parsed.table,
      count: parsed.fields.length,
      source: SOURCE_LABELS[parsed.source] || "",
      warnings: parsed.warnings,
    });
    // 가져온 뒤에도 열어 둔다 — 한 번에 맞게 붙여넣는 일이 드물어서(방언·따옴표·제약조건)
    // 대개 고쳐서 다시 누른다. 접으면 그때마다 다시 펴야 한다.
  };

  const regenerate = () => {
    const made = generateRows(fields, count, { dialect });
    setRows(sortRows(fields, made, { by: sortBy, dir: sortDir })); };

  const named = fields.filter((f) => f.name.trim() !== "");
  const rowKeys = rows.length ? Object.keys(rows[0]) : [];
  const stale = named.map((f) => f.name).join(" ") !== rowKeys.join(" ");

  const buildOutput = () => {
    if (!rows.length || !named.length) return "";
    if (format === "csv") return toCsv(named, rows, { header, lineEnding, bom });
    if (format === "json") return toJson(named, rows);
    if (format === "sql") {
      const insert = toInsertSql(named, rows, { table: tableName, dialect, batch });
      return withDdl ? `${toCreateTable(named, { table: tableName, dialect })}\n\n${insert}` : insert;
    }
    return "";
  };
  const output = buildOutput();

  const download = () => {
    const name = format === "sql" ? "data.sql"
      : `${tableName || "sample"}.${format === "json" ? "json" : "csv"}`;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
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
      <ToolHeader title="DB 더미데이터 생성기" />

      <div className="toolbar">
        <label className="select-label">
          <b>DB</b>
          <select value={dialect} onChange={(e) => changeDialect(e.target.value)}>
            {SQL_DIALECTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </label>
        <label className="select-label">
          테이블명
          <input className="krw-input small mono" value={tableName} onChange={(e) => setTableName(e.target.value)} spellCheck={false} />
        </label>
        <div className="toolbar-right">
          {/* 붙여넣으면 컬럼을 대신 채워 준다. 무엇을 붙여넣는지는 열었을 때 placeholder 가 보여 준다. */}
          <button type="button" className="btn" onClick={() => setSqlOpen((v) => !v)} aria-expanded={sqlOpen}>
            {sqlOpen ? "▾" : "▸"} 스키마 붙여넣기
          </button>
        </div>
      </div>


      {sqlOpen && (
        <div className="sql-import">
          <textarea
            className="area code"
            rows={8}
            value={sqlInput}
            onChange={(e) => setSqlInput(e.target.value)}
            spellCheck={false}
            placeholder={IMPORT_PLACEHOLDER}
          />
          <div className="toolbar">
            <button type="button" className="btn primary" onClick={importSql} disabled={!sqlInput.trim()}>
              컬럼 가져오기
            </button>
            <button type="button" className="btn" onClick={() => setSqlInput(SAMPLE_SQL)}>
              예시 넣기
            </button>
            <button type="button" className="btn ghost" onClick={() => { setSqlInput(""); setImportResult(null); }}>
              비우기
            </button>
          </div>
        </div>
      )}

      {importResult?.error && <div className="notice error">{importResult.error}</div>}
      {importResult && !importResult.error && (
        <div className="notice ok">
          {importResult.source && <>{importResult.source} 로 읽었습니다 — </>}
          <b>{importResult.table}</b> 의 컬럼 {importResult.count}개.
          {importResult.warnings?.length > 0 && (
            <ul className="plain-list">
              {importResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      <h2 className="sub-heading">컬럼 정의</h2>

      <div className="schema-head">
        <span>컬럼명</span>
        <span>데이터타입</span>
        <span>옵션</span>
        <span>비고</span>
        <span>NULL %</span>
        <span />
      </div>

      <div className="schema-list">
        {fields.map((f, i) => {
          const type = getDbType(dialect, f.type);
          return (
            <div
              className={`schema-row ${dragUid === f.uid ? "dragging" : ""} ${overUid === f.uid ? "drop-target" : ""}`}
              key={f.uid}
              draggable={handleArmed}
              onDragStart={(e) => {
                setDragUid(f.uid);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", f.uid);
              }}
              onDragEnd={endDrag}
              onDragOver={(e) => {
                if (!dragUid) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overUid !== f.uid) setOverUid(f.uid);
              }}
              onDragLeave={() => { if (overUid === f.uid) setOverUid(null); }}
              onDrop={(e) => {
                e.preventDefault();
                reorder(dragUid, f.uid);
                endDrag();
              }}
            >
              <input
                className="krw-input small mono"
                value={f.name}
                onChange={(e) => patch(f.uid, { name: e.target.value })}
                placeholder="column_name"
                spellCheck={false}
                aria-label={`${i + 1}번 컬럼명`}
              />

              <select value={f.type} onChange={(e) => changeType(f.uid, e.target.value)} aria-label={`${i + 1}번 데이터타입`}>
                {types.map((t) => <option key={t.key} value={t.key}>{t.key}</option>)}
              </select>

              <div className="schema-opts">
                {(type?.params || []).map((p) => (
                  <label key={p.key} className="opt">
                    <span>{p.label}</span>
                    {p.kind === "select" ? (
                      <select
                        value={f.params[p.key] ?? p.default}
                        onChange={(e) => patch(f.uid, { params: { ...f.params, [p.key]: e.target.value } })}
                      >
                        {p.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        className="krw-input small"
                        type={p.kind === "number" ? "number" : p.kind === "date" ? "date" : "text"}
                        value={f.params[p.key] ?? ""}
                        onChange={(e) => patch(f.uid, { params: { ...f.params, [p.key]: e.target.value } })}
                        spellCheck={false}
                      />
                    )}
                  </label>
                ))}
                {!type?.params?.length && <span className="muted opt-none">옵션 없음</span>}
              </div>

              <input
                className="krw-input small"
                value={f.note}
                onChange={(e) => patch(f.uid, { note: e.target.value })}
                placeholder="설명 (선택)"
                aria-label={`${i + 1}번 비고`}
              />

              <input
                className="krw-input small"
                type="number"
                min="0"
                max="100"
                value={f.nullPercent}
                onChange={(e) => patch(f.uid, { nullPercent: Number(e.target.value) })}
                aria-label={`${i + 1}번 NULL 비율`}
              />

              <div className="schema-actions">
                <button
                  type="button"
                  className="drag-handle"
                  title="끌어서 순서 변경 (화살표 키로도 가능)"
                  aria-label={`${i + 1}번 컬럼 순서 변경. 끌어 놓거나 위/아래 화살표 키를 누르세요`}
                  onMouseDown={() => setHandleArmed(true)}
                  onMouseUp={() => setHandleArmed(false)}
                  onBlur={() => setHandleArmed(false)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") { e.preventDefault(); move(f.uid, -1); }
                    if (e.key === "ArrowDown") { e.preventDefault(); move(f.uid, 1); }
                  }}
                >
                  ⠿
                </button>
                <button type="button" className="btn icon" onClick={() => removeField(f.uid)} aria-label={`${i + 1}번 컬럼 삭제`}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="toolbar">
        <button type="button" className="btn" onClick={addField}>+ 컬럼 추가</button>
        <div className="toolbar-right">
          <label className="select-label">
            행 수
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 10, 25, 50, 100, 121, 250, 500].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="select-label">
            ORDER BY
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="">(없음)</option>
              {named.map((f) => <option key={f.uid} value={f.name}>{f.name}</option>)}
            </select>
          </label>
          {sortBy && (
            <div className="seg">
              <button type="button" className={sortDir === "asc" ? "on" : ""} onClick={() => setSortDir("asc")}>ASC</button>
              <button type="button" className={sortDir === "desc" ? "on" : ""} onClick={() => setSortDir("desc")}>DESC</button>
            </div>
          )}
          <button type="button" className="btn primary" onClick={regenerate} disabled={!named.length}>생성</button>
        </div>
      </div>

      {/* 알림은 "지금 뭔가 어긋났다" 일 때만 띄운다. 첫 화면의 안내문은 빈 컬럼 줄이 대신한다. */}
      {named.length > 0 && stale && rows.length > 0 && (
        <div className="notice info">컬럼 정의가 바뀌었습니다. <b>생성</b>을 눌러 반영하세요.</div>
      )}

      <h2 className="sub-heading">결과</h2>

      <div className="toolbar">
        <div className="seg">
          {FORMATS.map((f) => (
            <button key={f.key} type="button" className={format === f.key ? "on" : ""} onClick={() => setFormat(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        {output && (
          <div className="toolbar-right">
            <button type="button" className="btn" onClick={download}>파일로 저장</button>
            <CopyButton value={() => output} label="전체 복사" />
          </div>
        )}
      </div>

      {format === "sql" && (
        <div className="toolbar">
          <label className="check-inline">
            <input type="checkbox" checked={withDdl} onChange={(e) => setWithDdl(e.target.checked)} />
            CREATE TABLE 포함
          </label>
          <label className="check-inline">
            <input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} disabled={dialect === "oracle"} />
            한 문장에 여러 행
          </label>
          {dialect === "oracle" && <span className="muted">Oracle 은 다중 VALUES 를 지원하지 않습니다</span>}
        </div>
      )}

      {format === "csv" && (
        <div className="toolbar">
          <label className="check-inline">
            <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} />
            헤더 포함
          </label>
          <label className="select-label">
            줄바꿈
            <select value={lineEnding} onChange={(e) => setLineEnding(e.target.value)}>
              <option value="lf">LF (unix)</option>
              <option value="crlf">CRLF (windows)</option>
            </select>
          </label>
          <label className="check-inline">
            <input type="checkbox" checked={bom} onChange={(e) => setBom(e.target.checked)} />
            BOM 붙이기 (엑셀 한글)
          </label>
        </div>
      )}

      {rows.length > 0 && named.length > 0 && format === "table" && (
        <>
          <div className="table-wrap scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  {named.map((f) => (
                    <th key={f.name} className="mono">
                      {f.name}
                      <span className="col-type">{renderType(dialect, f)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="num">{i + 1}</td>
                    {rowKeys.map((c) => (
                      <td key={c} className="mono">
                        {r[c] === null ? <span className="muted">NULL</span> : String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="statusbar">
            <span>행 <b>{rows.length}</b></span>
            <span>열 <b>{rowKeys.length}</b></span>
            <span className="muted">{SQL_DIALECTS.find((d) => d.key === dialect)?.label}</span>
          </div>
        </>
      )}

      {output && format !== "table" && (
        <>
          <textarea className="area code readonly" rows={20} value={output} readOnly spellCheck={false} />
          <div className="statusbar">
            <span>행 <b>{rows.length}</b></span>
            <span>{(new Blob([output]).size / 1024).toFixed(1)}KB</span>
            {format === "sql" && <span className="muted">{SQL_DIALECTS.find((d) => d.key === dialect)?.label}</span>}
          </div>
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
