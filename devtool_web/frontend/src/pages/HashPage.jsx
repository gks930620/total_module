// 해시 생성기 (텍스트 · 파일)
import { useState, useEffect, useCallback } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { hashAll, HASH_ALGOS, hmacAll, HMAC_ALGOS, compareHash } from "../lib/hash.js";
import { formatBytes } from "../lib/bytes.js";

const tool = getToolBySlug("hash");

/** 예시 — 널리 알려진 값이라 다른 도구와 대조해 보기 좋다 */
const SAMPLE = "hello";

const GUIDE = {
  intro: "텍스트나 파일의 해시를 CRC32·MD5·SHA-1·SHA-256·SHA-384·SHA-512 로 한꺼번에 계산합니다. 비밀키를 넣으면 같은 화면이 HMAC 계산으로 바뀌고, 받은 해시를 '기대값' 에 붙여넣으면 어느 알고리즘의 값과 같은지 대신 대조해 줍니다.",
  screen: {
    layout: "stack",
    left: { head: "텍스트 / 파일 탭 · 비밀키 · 기대값", body: "텍스트를 적거나 파일을 끌어다 놓기" },
    right: { head: "알고리즘별 해시 목록", body: "일치한 줄을 표시 · 줄마다 복사" },
    caption: "위에 넣으면 아래 해시가 즉시 계산됩니다.",
  },
  example: {
    in: "hello",
    out: `MD5      5d41402abc4b2a76b9719d911017c592
SHA-1    aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d
SHA-256  2cf24dba5fb0a30e26e83b2ac5b9e29e
         1b161e5c1fa7425e73043362938b9824`,
  },
  notes: [
    "64자짜리 16진수 두 줄을 눈으로 대조하면 사람이 틀립니다. 받은 값을 '기대값' 에 넣으면 맞다 · 틀리다 · 해시가 아니다를 구분해 알려 줍니다.",
    "비밀키 칸을 채우면 그냥 해시가 아니라 HMAC 이 됩니다. 비우면 다시 일반 해시로 돌아갑니다.",
    "MD5·SHA-1 은 충돌이 발견된 알고리즘입니다. 서명·비밀번호 저장에 쓰지 마세요 — 비밀번호는 bcrypt·Argon2 같은 전용 알고리즘을 씁니다.",
    "CRC32 는 엄밀히는 오류 검출용 체크섬입니다. 보안 목적에는 쓸 수 없지만 전송 오류 확인에는 여전히 쓰입니다.",
    "파일은 브라우저 메모리에서만 읽습니다 — 네트워크 요청이 없다는 것을 개발자도구에서 확인할 수 있습니다. 수백 MB 이상이면 탭이 느려질 수 있습니다.",
  ],
};

export function HashPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [upper, setUpper] = useState(false);
  const [hmacKey, setHmacKey] = useState("");
  const [expected, setExpected] = useState("");
  const [bytes, setBytes] = useState(null);   // 파일 모드에서 다시 계산하려고 들고 있는다

  // 키를 넣으면 HMAC 이 된다. 별도 탭으로 가르지 않는 이유 —
  // 하는 일이 "이 데이터의 지문" 으로 같고, 탭을 가르면 키를 넣을 수 있다는 걸 모른다.
  const keyed = hmacKey.trim() !== "";
  const algos = keyed ? HMAC_ALGOS : HASH_ALGOS;

  // 이 effect 는 "입력 → 비동기 해시 계산" 이라는 외부 작업만 담당한다.
  // 화면 상태(busy 켜기 / 결과 비우기)는 입력 핸들러에서 동기적으로 처리한다 —
  // effect 안에서 동기 setState 를 하면 렌더가 불필요하게 연쇄된다.
  useEffect(() => {
    if (mode !== "text" || text === "") return undefined;
    let cancelled = false;
    const run = keyed ? hmacAll(hmacKey, text) : hashAll(text);
    run.then((out) => {
      if (!cancelled) {
        setResults(out);
        setBusy(false);
      }
    });
    return () => { cancelled = true; };
  }, [text, mode, keyed, hmacKey]);

  // 파일은 다시 읽지 않고 들고 있던 바이트로 재계산한다 — 키를 고칠 때마다 파일을 다시 고를 수는 없다
  useEffect(() => {
    if (mode !== "file" || !bytes) return undefined;
    let cancelled = false;
    const run = keyed ? hmacAll(hmacKey, bytes) : hashAll(bytes);
    run.then((out) => {
      if (!cancelled) {
        setResults(out);
        setBusy(false);
      }
    });
    return () => { cancelled = true; };
  }, [bytes, mode, keyed, hmacKey]);

  const onTextChange = (value) => {
    setText(value);
    if (value === "") {
      setResults(null);
      setBusy(false);
    } else {
      setBusy(true);
    }
  };

  const readFile = useCallback((file) => {
    if (!file) return;
    setBusy(true);
    setFileInfo({ name: file.name, size: file.size });
    const reader = new FileReader();
    reader.onload = () => setBytes(new Uint8Array(reader.result));
    reader.readAsArrayBuffer(file);
  }, []);

  const show = (v) => (upper ? String(v).toUpperCase() : String(v));

  // "값을 만드는 것" 보다 "남이 준 값과 같은가" 가 이 도구의 진짜 쓰임이다.
  // 64자 16진수 두 줄을 눈으로 대조하게 두면 사람이 틀린다.
  const cmp = results ? compareHash(results, expected) : { checked: false };

  return (
    <article className="tool-page">
      <ToolHeader title="해시 생성기" />

      <div className="toolbar">
        <div className="seg">
          <button type="button" className={mode === "text" ? "on" : ""} onClick={() => { setMode("text"); setResults(null); setFileInfo(null); setBytes(null); }}>텍스트</button>
          <button type="button" className={mode === "file" ? "on" : ""} onClick={() => { setMode("file"); setResults(null); }}>파일</button>
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
          대문자로 표시
        </label>
        <div className="toolbar-right">
          <button type="button" className="btn" onClick={() => { setMode("text"); onTextChange(SAMPLE); }}>예시 넣기</button>
        </div>
      </div>

      <div className="toolbar">
        <label className="select-label grow">
          비밀키
          <input
            className="krw-input mono"
            value={hmacKey}
            onChange={(e) => setHmacKey(e.target.value)}
            placeholder="넣으면 HMAC 이 됩니다 (비우면 그냥 해시)"
            spellCheck={false}
          />
        </label>
        <label className="select-label grow">
          기대값
          <input
            className="krw-input mono"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="받은 해시를 붙여넣으면 맞는지 알려 줍니다"
            spellCheck={false}
          />
        </label>
      </div>

      {/* 맞다 / 틀리다 / 해시가 아니다 — 셋을 구분해 말한다 */}
      {cmp.checked && (
        <div className={`verify-result ${cmp.matched ? "ok" : cmp.invalid ? "unknown" : "fail"}`}>
          <span className="material-icons">
            {cmp.matched ? "check_circle" : cmp.invalid ? "help" : "cancel"}
          </span>
          <div>
            {cmp.matched && <><b>{algos.find((a) => a.key === cmp.matched)?.label ?? cmp.matched} 값과 같습니다.</b></>}
            {!cmp.matched && cmp.invalid && <>16진수 해시로 보이지 않습니다. 붙여넣은 값을 확인해 주세요.</>}
            {!cmp.matched && !cmp.invalid && (
              <>
                <b>맞는 값이 없습니다.</b>
                <div className="verify-why">
                  {cmp.guessed
                    ? `길이로 보면 ${cmp.guessed.toUpperCase()} 값 같은데, 계산 결과와 다릅니다.`
                    : `${cmp.normalized.length}자짜리 값인데 여기 있는 어떤 알고리즘과도 길이가 맞지 않습니다.`}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {mode === "text" ? (
        <div className="field">
          <span>입력 텍스트 (UTF-8 기준으로 해싱)</span>
          <textarea
            className="area"
            rows={6}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="해시를 구할 텍스트를 입력하세요"
            spellCheck={false}
          />
        </div>
      ) : (
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files?.[0]); }}
        >
          <span className="material-icons">upload_file</span>
          <p>파일을 여기에 끌어다 놓거나 선택하세요 (업로드되지 않습니다)</p>
          <label className="btn">
            파일 선택
            <input type="file" hidden onChange={(e) => readFile(e.target.files?.[0])} />
          </label>
          {fileInfo && (
            <p className="hint">{fileInfo.name} · {formatBytes(fileInfo.size)}</p>
          )}
        </div>
      )}

      {busy && <div className="notice">계산 중입니다…</div>}

      {results && !busy && (
        <div className="kv-card">
          {algos.map((algo) => (
            <div className="kv-row" key={algo.key}>
              <span className="kv-label">
                {algo.label}
                {algo.weak && <span className="tag warn">취약</span>}
                {algo.note && <small className="muted block">{algo.note}</small>}
              </span>
              <span className={`kv-value mono break ${cmp.matched === algo.key ? "hit" : ""}`}>
                {show(results[algo.key])}
              </span>
              <CopyButton value={() => show(results[algo.key])} label="복사" />
            </div>
          ))}
        </div>
      )}

      {!results && !busy && (
        <div className="empty-state">
          {mode === "text" ? "텍스트를 입력하면 해시가 즉시 계산됩니다." : "파일을 선택하면 해시가 계산됩니다."}
        </div>
      )}

      <div className="notice warn">
        <strong>주의</strong> — MD5·SHA-1 은 충돌이 발견된 알고리즘입니다. 서명·비밀번호 저장에는 쓰지 마세요.
      </div>

      <ToolGuide {...GUIDE} />
    </article>
  );
}
