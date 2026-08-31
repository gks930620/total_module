// 다이어그램 도구 6종이 함께 쓰는 화면.
//
// 종류마다 페이지를 따로 두는 이유는 검색 때문이다 — "ERD 그리기" 와 "시퀀스 다이어그램" 은
// 다른 검색어다. 하지만 화면이 하는 일은 같으므로 여기 하나만 둔다.
//
// 배치는 이 프로젝트의 원칙 그대로 — **넣는 것은 왼쪽, 나온 것은 오른쪽.**
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ToolHeader } from "./ToolHeader.jsx";
import { ToolGuide } from "./ToolGuide.jsx";
import { CopyButton } from "./CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { renderMermaid } from "../lib/mermaidRender.js";
import { templatesFor } from "../lib/diagram/templates.js";
import { parseDdl, parseJavaSource } from "../lib/diagram/parseCode.js";
import { toErMermaid, toClassMermaid } from "../lib/diagram/toMermaid.js";
import { fromParsed } from "../lib/canvas/model.js";
import { CanvasEditor } from "./canvas/CanvasEditor.jsx";
import { SequenceEditor } from "./canvas/SequenceEditor.jsx";

/** 지금 화면이 다크인지. mermaid 색을 여기에 맞춘다. */
function isDark() {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-theme") === "dark";
}

/**
 * "코드 붙여넣기" 를 지원하는 종류의 설정.
 * 이게 이 도구가 mermaid.live 와 다른 지점이다 — 문법을 배우지 않아도 그림이 나온다.
 */
const IMPORTERS = {
  er: {
    label: "SQL 붙여넣기",
    placeholder: "CREATE TABLE member (\n  id BIGINT PRIMARY KEY,\n  email VARCHAR(255) NOT NULL UNIQUE\n);",
    help: "CREATE TABLE 문을 그대로 붙여넣으세요. FOREIGN KEY 를 읽어 관계선까지 그립니다.",
    run: (text) => { const m = parseDdl(text); return { m, out: toErMermaid(m) }; },
  },
  class: {
    label: "자바 소스 붙여넣기",
    placeholder: "@Entity\npublic class Member {\n    @Id private Long id;\n    @OneToMany private List<Order> orders;\n}",
    help: "자바 파일을 그대로 붙여넣으세요. extends·implements·JPA 연관을 읽어 선을 잇습니다.",
    run: (text) => { const m = parseJavaSource(text); return { m, out: toClassMermaid(m) }; },
  },
};

/** 그리기 탭이 있는 종류 — /diagram(간트·마인드맵 …)은 노드-간선 모델이 아니라 없다 */
const DRAWABLE = new Set(["er", "class", "flowchart", "state", "sequence"]);

export function DiagramTool({ tool, type, guide, intro }) {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const templates = useMemo(() => templatesFor(type), [type]);
  const importer = IMPORTERS[type] || null;

  const [text, setText] = useState(() => templates[0]?.text ?? "");
  const [source, setSource] = useState("");           // 붙여넣은 코드
  const [mode, setMode] = useState(importer ? "code" : "mermaid");
  const [imported, setImported] = useState(null);      // {warnings, entities} — 읽은 결과 요약
  // "그리기로 보내기" — seed 를 바꿀 때마다 nonce 로 편집기를 새로 mount 한다(효과 없이 초기값으로 반영)
  const [draw, setDraw] = useState({ seed: null, nonce: 0 });
  const [render, setRender] = useState({ key: null, svg: "", error: null });
  const [dark, setDark] = useState(isDark);
  const [zoom, setZoom] = useState(1);
  const boxRef = useRef(null);

  // 테마 토글을 누르면 다이어그램 색도 따라가야 한다 — <html data-theme> 를 지켜본다
  useEffect(() => {
    const el = document.documentElement;
    const ob = new MutationObserver(() => setDark(isDark()));
    ob.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => ob.disconnect();
  }, []);

  // 렌더는 비동기다. 무엇에 대한 결과인지 key 로 함께 저장해, 입력이 바뀐 뒤
  // 옛 그림이 남지 않게 한다(JwtPage 와 같은 방식 — 효과 안에서 동기 setState 를 하지 않는다).
  const renderKey = useMemo(() => JSON.stringify([text, dark]), [text, dark]);

  useEffect(() => {
    let alive = true;
    renderMermaid(text, { dark }).then((r) => {
      if (!alive) return;
      setRender(r.ok ? { key: renderKey, svg: r.svg, error: null } : { key: renderKey, svg: "", error: r });
    });
    return () => { alive = false; };
  }, [renderKey, text, dark]);

  const shown = render.key === renderKey ? render : null;

  const applyImport = useCallback(() => {
    if (!importer) return;
    const { m, out } = importer.run(source);
    setImported({ warnings: m.warnings, count: m.entities.length, relations: m.relations.length, model: m });
    setText(out);
    setMode("mermaid");
  }, [importer, source]);

  /** 붙여넣은 코드에서 읽은 것을 그리기 캔버스의 시작 문서로 */
  const sendToDraw = useCallback(() => {
    if (!imported?.model) return;
    setDraw((d) => ({ seed: fromParsed(type === "er" ? "er" : "class", imported.model), nonce: d.nonce + 1 }));
    setMode("draw");
  }, [imported, type]);

  const downloadSvg = () => {
    if (!shown?.svg) return;
    const blob = new Blob([shown.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${type}-diagram.svg`);
    URL.revokeObjectURL(url);
  };

  /** SVG → PNG. 캔버스에 그려서 뽑는다 — 여기서도 서버로 나가는 것은 없다. */
  const downloadPng = () => {
    if (!shown?.svg) return;
    const svgEl = boxRef.current?.querySelector("svg");
    const w = Math.max(svgEl?.viewBox?.baseVal?.width || svgEl?.clientWidth || 800, 400);
    const h = Math.max(svgEl?.viewBox?.baseVal?.height || svgEl?.clientHeight || 600, 300);
    const scale = 2;   // 그냥 뽑으면 흐릿하다

    const img = new Image();
    const blob = new Blob([shown.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      // 배경을 칠하지 않으면 투명 PNG 가 되어 어두운 곳에 붙이면 글자가 안 보인다
      ctx.fillStyle = dark ? "#1b1930" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      triggerDownload(canvas.toDataURL("image/png"), `${type}-diagram.png`);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  return (
    <article className="tool-page">
      <ToolHeader tool={tool} />
      {intro && <p className="tool-intro">{intro}</p>}

      {(importer || DRAWABLE.has(type)) && (
        <div className="toolbar">
          <div className="seg">
            {importer && (
              <button type="button" className={mode === "code" ? "on" : ""} onClick={() => setMode("code")}>
                {importer.label}
              </button>
            )}
            <button type="button" className={mode === "mermaid" ? "on" : ""} onClick={() => setMode("mermaid")}>
              직접 쓰기
            </button>
            {DRAWABLE.has(type) && (
              <button type="button" className={mode === "draw" ? "on" : ""} onClick={() => setMode("draw")}>
                그리기
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "draw" && (
        type === "sequence"
          ? <SequenceEditor />
          : <CanvasEditor key={draw.nonce} type={type} seed={draw.seed} />
      )}

      {mode !== "draw" && (
      <div className="split">
        {/* 왼쪽 — 넣는 것 */}
        <section className="panel">
          <div className="panel-head tools">
            <span>입력</span>
            <div className="panel-tools">
              {templates.length > 0 && (
                <select
                  className="tpl-select"
                  value=""
                  onChange={(e) => {
                    const t = templates[Number(e.target.value)];
                    if (t) { setText(t.text); setMode("mermaid"); setImported(null); }
                  }}
                  aria-label="예시 넣기"
                >
                  <option value="">예시 넣기…</option>
                  {templates.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
                </select>
              )}
            </div>
          </div>

          {mode === "code" && importer ? (
            <div className="field-stack tight">
              <p className="hint">{importer.help}</p>
              <textarea
                className="json-input mono mid"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={importer.placeholder}
                spellCheck={false}
                aria-label={importer.label}
              />
              <div className="key-actions">
                <button type="button" className="btn primary" onClick={applyImport} disabled={!source.trim()}>
                  그림으로 만들기
                </button>
                <button type="button" className="btn ghost" onClick={() => { setSource(""); setImported(null); }}>
                  비우기
                </button>
              </div>
            </div>
          ) : (
            <textarea
              className="json-input mono"
              value={text}
              onChange={(e) => { setText(e.target.value); setImported(null); }}
              placeholder="mermaid 문법으로 직접 쓰거나, 위에서 예시를 넣어 보세요."
              spellCheck={false}
              aria-label="다이어그램 문법"
            />
          )}

          {/* 읽어낸 결과 요약 — 빠뜨린 게 있으면 여기서 말한다 */}
          {imported && (
            <div className={`notice ${imported.warnings.length ? "warn" : "ok"}`}>
              <b>{imported.count}개</b>를 읽었고 관계 <b>{imported.relations}개</b>를 이었습니다.
              {imported.model && (
                <button type="button" className="btn" style={{ marginLeft: 10 }} onClick={sendToDraw}>
                  그리기로 보내기
                </button>
              )}
              {imported.warnings.length > 0 && (
                <ul className="verify-hints">
                  {imported.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* 오른쪽 — 나온 것 */}
        <section className="panel">
          <div className="panel-head tools">
            <span>미리보기</span>
            <div className="panel-tools">
              <button type="button" className="btn ghost icon" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} title="축소" aria-label="축소">−</button>
              <span className="zoom-val">{Math.round(zoom * 100)}%</span>
              <button type="button" className="btn ghost icon" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} title="확대" aria-label="확대">+</button>
              <button type="button" className="btn ghost" onClick={() => setZoom(1)}>원래대로</button>
            </div>
          </div>

          {shown?.error ? (
            <div className="notice error">
              <b>그리지 못했습니다.</b>
              <div className="verify-why">{shown.error.message}</div>
            </div>
          ) : null}

          <div className="diagram-box" ref={boxRef}>
            {shown?.svg ? (
              <div
                className="diagram-canvas"
                style={{ transform: `scale(${zoom})` }}
                // mermaid 가 securityLevel:"strict" 로 이미 소독한 SVG 다. 스크립트는 제거된다.
                dangerouslySetInnerHTML={{ __html: shown.svg }}
              />
            ) : (
              !shown?.error && <div className="panel-empty">그리는 중…</div>
            )}
          </div>

          <div className="key-actions diagram-actions">
            <button type="button" className="btn" onClick={downloadSvg} disabled={!shown?.svg}>SVG 저장</button>
            <button type="button" className="btn" onClick={downloadPng} disabled={!shown?.svg}>PNG 저장</button>
            <CopyButton value={() => text} label="문법 복사" />
          </div>
        </section>
      </div>
      )}

      <ToolGuide {...guide} />
    </article>
  );
}

function triggerDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
