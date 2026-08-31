// Base64 인코드 · 디코드 (B64-01~04). 전부 클라이언트(NFR-02).
// JWT 는 /jwt 로 갈라져 나갔다 — 같은 Base64URL 을 쓴다는 것 말고는 화면에 공통점이 없다.
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { encodeBase64, decodeBase64Info, looksUrlSafe } from "../lib/base64.js";

const tool = getToolBySlug("base64");

const SAMPLE = "안녕하세요 hello 123";

const GUIDE = {
  intro: "문자열을 Base64 로 바꾸거나 Base64 를 원래 문자로 되돌립니다. UTF-8 기준이라 한글도 그대로 처리하고, 가운데 화살표 버튼을 누르면 지금 결과가 다음 입력이 되어 바로 되돌려 볼 수 있습니다.",
  screen: {
    layout: "split",
    left: { head: "입력 · 문자", body: "인코딩할 문자열" },
    right: { head: "출력 · Base64", body: "결과 · 복사" },
    caption: "가운데 화살표를 누르면 방향이 인코드 ↔ 디코드로 바뀝니다.",
  },
  example: {
    in: "안녕 hello",
    out: "7JWI64WVIGhlbGxv",
  },
  notes: [
    "URL-safe 는 세 가지가 다릅니다 — '+' 대신 '-', '/' 대신 '_', 끝의 패딩 '=' 제거. 엄격한 디코더는 패딩이 없으면 거부합니다.",
    "디코딩할 때는 고를 것이 없습니다. '-' '_' 를 자동으로 되돌리고 패딩도 다시 채웁니다.",
    "Base64 는 암호화가 아닙니다. 열쇠 없이 누구나 되돌릴 수 있으니 토큰을 감싸 보내는 건 감싸지 않은 것과 같습니다.",
    "8비트 3개를 6비트 4개로 다시 자르므로 항상 약 33% 커집니다.",
    "읽어낸 값이 텍스트가 아니면(이미지 같은 바이너리) 그렇다고 알리고 앞부분을 16진수로 보여 줍니다.",
    "모든 처리는 브라우저 안에서 이뤄지며 저장하지 않습니다.",
  ],
};

export function Base64Page() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [text, setText] = useState("");
  // 인코드로 시작한다 — "문자 → Base64" 가 왼쪽에서 오른쪽으로 읽히는 자연스러운 방향이고,
  // 디코드하러 온 사람은 붙여넣기 전에 화살표를 한 번 누르면 된다.
  const [mode, setMode] = useState("encode"); // encode | decode
  const [urlSafe, setUrlSafe] = useState(false);

  const output = useMemo(() => {
    if (!text) return { value: "", error: null, detected: false };
    if (mode === "encode") {
      return { value: encodeBase64(text, urlSafe), error: null, detected: false };
    }
    const r = decodeBase64Info(text);
    if (!r.ok) return { value: "", error: r.reason, detected: false };
    return {
      value: r.text,
      error: null,
      detected: looksUrlSafe(text),
      // 텍스트가 아니면 화면이 그렇게 말해야 한다 — 안 그러면 깨진 글자를 보고 자기 잘못인 줄 안다
      notText: !r.isText,
      byteLength: r.byteLength,
      hex: r.hex,
    };
  }, [text, mode, urlSafe]);

  const encoding = mode === "encode";

  // 방향을 뒤집으면 지금 결과가 다음 입력이 된다 — 인코드한 값을 바로 되돌려 볼 수 있다
  const flip = () => {
    setText(output.value || "");
    setMode(encoding ? "decode" : "encode");
  };

  return (
    <article className="tool-page">
      <ToolHeader title="Base64 인코더 · 디코더" />

      <div className="split with-swap">
        <section className="panel">
          <div className="panel-head tools">
            {/* 무엇을 넣는 칸인지 이름으로 말한다 — 모드를 따로 읽지 않아도 안다 */}
            <span>입력 · {encoding ? "문자" : "Base64"}</span>
            <div className="panel-tools">
              {/* 디코드는 '-' '_' 를 자동으로 되돌리므로 고를 것이 없다 */}
              {encoding && (
                <label className="check-label">
                  <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} />
                  URL-safe
                </label>
              )}
              <button type="button" className="btn" onClick={() => { setMode("encode"); setText(SAMPLE); }}>예시 넣기</button>
              <button type="button" className="btn ghost" onClick={() => setText("")}>비우기</button>
            </div>
          </div>
          <textarea
            className="json-input mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={encoding ? "인코딩할 문자열을 입력하세요" : "Base64 문자열을 붙여넣으세요"}
            spellCheck={false}
            aria-label={encoding ? "인코딩할 문자열" : "디코딩할 Base64"}
          />
        </section>

        {/* 지금 어느 방향인지를 두 패널 사이에서 보여 준다. 눌러서 뒤집는다. */}
        <div className="swap-slot">
          <button type="button" className="dir-btn" onClick={flip} title="방향 바꾸기">
            <span className="dir-arrow" aria-hidden="true">→</span>
            <span className="dir-label">{encoding ? "인코드" : "디코드"}</span>
          </button>
        </div>

        <section className="panel">
          <div className="panel-head tools">
            <span>
              출력 · {encoding ? "Base64" : "문자"}
              {!encoding && output.detected && <em className="tag">URL-safe</em>}
              {output.byteLength != null && <em className="tag">{output.byteLength}바이트</em>}
            </span>
            <div className="panel-tools">
              {output.value && <CopyButton value={() => output.value} label="복사" />}
            </div>
          </div>
          {output.error && <div className="notice error">{output.error}</div>}
          {/* 깨진 글자를 그냥 보여 주면 사용자가 자기 입력을 의심한다 — 무엇인지 말해 준다 */}
          {output.notText && (
            <div className="notice warn">
              읽어낸 값이 <b>텍스트가 아닙니다</b>(이미지 같은 바이너리로 보입니다).
              아래 글자가 깨져 보이는 것은 정상입니다.
              <div className="mono hex-peek">{output.hex}</div>
            </div>
          )}
          {!output.error && <textarea className="json-input mono readonly" value={output.value} readOnly spellCheck={false} aria-label="결과" />}
        </section>
      </div>

      <ToolGuide {...GUIDE} />
    </article>
  );
}
