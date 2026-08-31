// UUID / ULID 생성기 + 분석기
import { useState } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { generateMany, inspectUuid, UUID_KINDS, NAMESPACES } from "../lib/uuid.js";
import { formatKst } from "../lib/timestamp.js";

const tool = getToolBySlug("uuid");

/** 예시 — v7 이라 생성 시각까지 되돌려 볼 수 있는 값 */
const SAMPLE_UUID = "018f3a5c-1b2d-7c3e-8f01-1234567890ab";

const GUIDE = {
  intro: "종류(UUID v1·v4·v5·v7·ULID)와 개수를 고르면 그 자리에서 만들어 줍니다. 아래 '분석' 칸에 기존 값을 붙여넣으면 몇 버전인지 알려 주고, v7·ULID 는 생성 시각까지 KST 로 되돌려 보여 줍니다.",
  screen: {
    layout: "stack",
    left: { head: "종류 · 개수 · 대문자 · 하이픈", body: "v5 는 네임스페이스와 이름을 함께 넣습니다" },
    right: { head: "생성 결과 → UUID 분석", body: "전체 복사 · 붙여넣어 버전·시각 확인" },
    caption: "종류를 바꾸면 목록이 그 자리에서 다시 만들어집니다.",
  },
  example: {
    in: "018f3a5c-1b2d-7c3e-8f01-1234567890ab",
    inLabel: "넣는 값 (분석)",
    out: `버전       v7 — 유닉스 시각 + 난수 (정렬 가능)
변형       RFC 4122
생성 시각  2024-05-03 02:31:05 (KST)`,
  },
  notes: [
    "무작위성이 필요하면 v4, DB 기본키로 쓸 거면 v7 을 권합니다 — v7 은 앞 48비트가 생성 시각이라 정렬이 되고, InnoDB 같은 클러스터드 인덱스에서 단편화가 훨씬 적습니다.",
    "v7 은 생성 시점이 값에 노출됩니다. 그게 곤란한 곳에는 v4 를 쓰세요.",
    "ULID 는 26자 Crockford Base32 문자열입니다. 고유하면서 사전식 정렬이 시간순이고, 하이픈이 없어 URL·파일명에 쓰기 편합니다.",
    "v5 는 네임스페이스와 이름을 조합해 만드는 방식이라 같은 이름이면 언제나 같은 UUID 가 나옵니다.",
    "난수는 브라우저 내장 crypto.getRandomValues(암호학적 난수)를 씁니다. Math.random 은 쓰지 않습니다.",
  ],
};

export function UuidPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [kind, setKind] = useState("v4");
  const [count, setCount] = useState(10);
  const [list, setList] = useState(() => generateMany("v4", 10));
  const [uppercase, setUppercase] = useState(false);
  const [hyphen, setHyphen] = useState(true);
  const [target, setTarget] = useState("");
  const [namespace, setNamespace] = useState(NAMESPACES[0].uuid);
  const [name, setName] = useState("");
  const [genError, setGenError] = useState(null);

  const current = UUID_KINDS.find((k) => k.key === kind);
  const needsName = current?.needsName === true;

  const regenerate = (k = kind, n = count, ns = namespace, nm = name) => {
    try {
      setList(generateMany(k, n, { namespace: ns, name: nm }));
      setGenError(null);
    } catch (e) {
      // 이름 기반인데 이름이 비었을 때가 대부분이다 — 목록을 비우고 이유를 말한다
      setList([]);
      setGenError(e.message);
    }
  };

  const decorate = (v) => {
    let out = v;
    if (!hyphen) out = out.replace(/-/g, "");
    return uppercase ? out.toUpperCase() : out;
  };

  const text = list.map(decorate).join("\n");
  const info = target.trim() ? inspectUuid(target) : null;

  return (
    <article className="tool-page">
      <ToolHeader title="UUID / ULID 생성기" description="UUID v4·v7과 ULID를 생성하고, 기존 값의 버전·생성 시각을 분석합니다." />

      <div className="toolbar">
        <label className="select-label">
          종류
          <select value={kind} onChange={(e) => { setKind(e.target.value); regenerate(e.target.value, count); }}>
            {UUID_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </label>
        <label className="select-label">
          개수
          <select value={count} onChange={(e) => { const n = Number(e.target.value); setCount(n); regenerate(kind, n); }}>
            {[1, 5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="btn primary" onClick={() => regenerate()}>다시 생성</button>
        <div className="toolbar-right">
          {kind !== "ulid" && (
            <>
              <label className="check-inline">
                <input type="checkbox" checked={hyphen} onChange={(e) => setHyphen(e.target.checked)} />
                하이픈
              </label>
              <label className="check-inline">
                <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
                대문자
              </label>
            </>
          )}
          <CopyButton value={() => text} label="전체 복사" />
        </div>
      </div>

      {/* 이름 기반(v3·v5)일 때만 나온다 — 다른 종류에는 넣을 것이 없다 */}
      {needsName && (
        <div className="toolbar">
          <label className="select-label">
            네임스페이스
            <select value={namespace} onChange={(e) => { setNamespace(e.target.value); regenerate(kind, count, e.target.value, name); }}>
              {NAMESPACES.map((n) => <option key={n.key} value={n.uuid}>{n.label}</option>)}
            </select>
          </label>
          <label className="select-label grow">
            이름
            <input
              className="krw-input mono"
              value={name}
              onChange={(e) => { setName(e.target.value); regenerate(kind, count, namespace, e.target.value); }}
              placeholder="example.com — 같은 이름이면 언제나 같은 UUID 가 나옵니다"
              spellCheck={false}
            />
          </label>
        </div>
      )}

      {genError && <div className="notice error">{genError}</div>}

      <p className="hint">{current?.hint}</p>

      <div className="panel">
        <div className="panel-head"><span>생성 결과 ({list.length}개)</span></div>
        <textarea className="area code readonly" rows={Math.min(16, Math.max(4, list.length))} value={text} readOnly spellCheck={false} />
      </div>

      <h2 className="sub-heading">UUID 분석<button type="button" className="btn" onClick={() => setTarget(SAMPLE_UUID)}>예시 넣기</button></h2>
      <div className="field">
        <span>분석할 UUID 를 붙여넣으세요</span>
        <input
          className="krw-input"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="018f3a5c-1b2d-7c3e-8f01-1234567890ab"
          spellCheck={false}
        />
      </div>

      {info && !info.ok && <div className="notice error">{info.reason}</div>}
      {info && info.ok && (
        <div className="kv-card">
          <div className="kv-row"><span className="kv-label">정규화</span><span className="kv-value mono">{info.normalized}</span></div>
          <div className="kv-row"><span className="kv-label">버전</span><span className="kv-value">{info.versionLabel}</span></div>
          <div className="kv-row"><span className="kv-label">variant</span><span className="kv-value">{info.variant}</span></div>
          {info.isNil && <div className="kv-row"><span className="kv-label">특이사항</span><span className="kv-value">NIL UUID (값 없음을 뜻하는 예약값)</span></div>}
          {info.timestampMs !== null && (
            <div className="kv-row">
              <span className="kv-label">생성 시각</span>
              <span className="kv-value mono">{formatKst(info.timestampMs)}</span>
            </div>
          )}
        </div>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
