// cURL → fetch / axios / Java / Python 코드 변환
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { parseCurl, curlToCode, CURL_TARGETS } from "../lib/codegen.js";

const tool = getToolBySlug("curl");

const SAMPLE = `curl -X POST 'https://api.example.com/v1/orders' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer eyJhbGciOi...' \\
  -d '{"sku":"A-1024","qty":2}'`;

const GUIDE = {
  intro: "개발자도구 네트워크 탭에서 'cURL 로 복사' 한 명령을 붙여넣으면 fetch·axios·자바·파이썬 코드로 바꿔 줍니다. 먼저 메서드·URL·헤더·본문을 어떻게 읽었는지 표로 보여 주므로, 코드를 믿기 전에 해석이 맞는지 확인할 수 있습니다.",
  screen: {
    layout: "stack",
    left: { head: "cURL 명령 (개발자도구 → 네트워크 → cURL 로 복사)", body: "위 탭에서 fetch · axios · Java · Python 선택" },
    right: { head: "해석 결과 → 변환된 코드", body: "코드 복사" },
    caption: "붙여넣으면 해석 표와 코드가 함께 나옵니다.",
  },
  example: {
    in: `curl -X POST 'https://api.example.com/v1/orders' \
  -H 'Content-Type: application/json' \
  -d '{"sku":"A-1024","qty":2}'`,
    out: `fetch("https://api.example.com/v1/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sku: "A-1024", qty: 2 }),
});`,
    outLabel: "나오는 값 (fetch)",
  },
  notes: [
    "-X(메서드) · -H(헤더) · -d/--data(본문) · --json · -F(폼) · -u(Basic 인증) · -k 를 처리하고, -s·-L·-v 같은 표시용 플래그는 무시합니다.",
    "역슬래시로 줄바꿈된 여러 줄 명령도 그대로 붙여넣으면 됩니다.",
    "자바 코드는 외부 의존성 없이 자바 11+ 표준 java.net.http.HttpClient 를 씁니다.",
    "-k(--insecure) 가 있으면 TLS 검증을 끄는 옵션이라고 알리고, 변환된 코드에는 반영하지 않습니다.",
    "토큰이 든 요청을 붙여넣어도 됩니다 — 변환은 전부 브라우저 안에서 일어나고 서버로 아무것도 보내지 않습니다. 다만 결과를 남과 공유할 때는 토큰을 지우고 주세요.",
  ],
};

export function CurlPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [input, setInput] = useState("");
  const [target, setTarget] = useState("fetch");

  const parsed = useMemo(() => (input.trim() ? parseCurl(input) : null), [input]);
  const code = useMemo(() => (parsed?.ok ? curlToCode(parsed, target) : ""), [parsed, target]);

  const onChange = (v) => setInput(v);

  return (
    <article className="tool-page">
      <ToolHeader title="cURL → 코드 변환" description="cURL 명령을 fetch·axios·Java·Python 코드로 바꿉니다." />

      <div className="toolbar">
        <div className="seg">
          {CURL_TARGETS.map((t) => (
            <button key={t.key} type="button" className={target === t.key ? "on" : ""} onClick={() => setTarget(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="toolbar-right">
          <button type="button" className="btn" onClick={() => onChange(SAMPLE)}>예제 넣기</button>
          <button type="button" className="btn ghost" onClick={() => setInput("")}>지우기</button>
        </div>
      </div>

      <div className="field">
        <span>cURL 명령 (개발자도구 → 네트워크 → cURL 로 복사)</span>
        <textarea className="area code" rows={8} value={input} onChange={(e) => onChange(e.target.value)}
          placeholder="curl -X POST 'https://api.example.com' -H 'Content-Type: application/json' -d '{}'" spellCheck={false} />
      </div>

      {parsed && !parsed.ok && <div className="notice error">{parsed.reason}</div>}

      {parsed?.ok && (
        <>
          <h2 className="sub-heading">해석 결과</h2>
          <div className="kv-card">
            <div className="kv-row"><span className="kv-label">메서드</span><span className="kv-value mono">{parsed.method}</span></div>
            <div className="kv-row"><span className="kv-label">URL</span><span className="kv-value mono break">{parsed.url}</span></div>
            {Object.entries(parsed.headers).map(([k, v]) => (
              <div className="kv-row" key={k}><span className="kv-label">{k}</span><span className="kv-value mono break">{v}</span></div>
            ))}
            {parsed.body && <div className="kv-row"><span className="kv-label">본문</span><span className="kv-value mono break">{parsed.body}</span></div>}
            {parsed.form.length > 0 && (
              <div className="kv-row"><span className="kv-label">폼 필드</span>
                <span className="kv-value mono">{parsed.form.map((f) => `${f.name}=${f.value}`).join(", ")}</span></div>
            )}
          </div>

          <h2 className="sub-heading">
            {CURL_TARGETS.find((t) => t.key === target)?.label}
            <CopyButton value={() => code} label="코드 복사" />
          </h2>
          <textarea className="area code readonly" rows={16} value={code} readOnly spellCheck={false} />

          {parsed.insecure && (
            <div className="notice warn">
              <strong>-k(--insecure)</strong> 가 있습니다 — TLS 인증서 검증을 끄는 옵션입니다.
              변환된 코드에는 반영하지 않았습니다. 운영 코드에서는 쓰지 마세요.
            </div>
          )}
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
