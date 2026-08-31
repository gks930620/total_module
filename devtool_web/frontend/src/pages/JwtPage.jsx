// JWT 디코드 · 검증 · 생성 (B64-05). 전부 클라이언트(NFR-02).
//
// 비밀키가 브라우저 밖으로 나가지 않는다는 점이 이 도구의 존재 이유다 —
// 그래서 다른 온라인 도구와 달리 비밀키를 받아 서명을 확인해 줄 수 있다.
import { useState, useMemo, useEffect } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { parseJwt, unixToKst, isExpired } from "../lib/base64.js";
import {
  signJwt, verifyJwt, SIGN_ALGOS, generateKeyPair, generateSecret,
  checkSecretStrength, signatureHints, requiredKeyBytes,
} from "../lib/jwt.js";

const tool = getToolBySlug("jwt");

/** 시각으로 해석해 한국 시간을 함께 보여 줄 클레임 */
const TIME_CLAIMS = ["exp", "iat", "nbf"];

/** 표준 클레임의 뜻 — 이름만 봐서는 알 수 없다 (RFC 7519 §4.1) */
const CLAIM_MEANING = {
  iss: "발급자",
  sub: "주체 — 보통 사용자 ID",
  aud: "수신자 — 누구 쓰라고 준 것인가",
  exp: "만료 시각",
  nbf: "이 시각 전에는 무효",
  iat: "발급 시각",
  jti: "토큰 고유 번호",
};

/** 예시 토큰 — HS256, 비밀키는 'your-256-bit-secret'(jwt.io 가 쓰는 표준 예시) */
const SAMPLE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const SAMPLE_HEADER = '{\n   "alg": "HS256",\n   "typ": "JWT"\n}';
const SAMPLE_PAYLOAD = '{\n   "sub": "1234567890",\n   "name": "홍길동",\n   "admin": true,\n   "iat": 1516239022\n}';

const GUIDE = {
  intro: "'토큰 읽기' 에 JWT 를 붙여넣으면 header·payload 를 풀어 보여 주고, 표준 클레임은 뜻과 한국 시간을 함께 붙여 줍니다. 비밀키를 넣으면 서명까지 확인하고, '토큰 만들기' 탭에서는 직접 서명한 토큰을 만들 수 있습니다. 키는 브라우저 밖으로 나가지 않습니다.",
  screen: {
    layout: "split",
    left: { head: "입력 · 토큰 / 비밀키", body: "eyJhbGciOi… 붙여넣기" },
    right: { head: "읽은 내용 · Header · Payload", body: "서명 확인 결과 · 만료 여부" },
    caption: "위 탭에서 '토큰 읽기' 와 '토큰 만들기' 를 오갑니다.",
  },
  example: {
    in: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`,
    out: `Header   { "alg": "HS256", "typ": "JWT" }
Payload  sub  1234567890   주체 — 보통 사용자 ID
         name John Doe
         iat  1516239022   발급 시각
                           2018-01-18 10:30:22 KST`,
  },
  notes: [
    "비밀키에는 서버 설정에 적힌 값(application.yml 의 jwt.secret, 환경변수 JWT_SECRET_KEY 등)을 그대로 넣습니다. HS* 는 서명과 검증에 같은 키를 씁니다.",
    "'키 해석' 은 그 문자열을 어떤 바이트로 볼지 고르는 것입니다 — UTF-8 바이트(secret.getBytes)와 Base64 디코드(Decoders.BASE64.decode). 서버의 키 로딩 코드와 맞춰야 하며, 모르면 두 버튼을 번갈아 눌러 서명이 맞는 쪽을 찾으면 됩니다.",
    "키 길이는 HS256 32바이트, HS384 48바이트, HS512 64바이트 이상이어야 합니다(RFC 7518). 짧으면 서명은 되지만 서버 라이브러리가 WeakKeyException 으로 거부합니다.",
    "HS256·384·512 와 RS·PS·ES 계열까지 11가지를 서명·검증합니다. 공개키 계열은 PEM 을 붙여넣거나 '키쌍 만들기' 로 그 자리에서 만들 수 있고, 못 다루는 알고리즘은 '틀렸다' 가 아니라 '확인할 수 없다' 고 표시합니다.",
    "JWT 는 암호화가 아닙니다. header·payload 는 Base64URL 로 인코딩만 되어 있어 누구나 읽습니다 — 보장하는 것은 '비밀' 이 아니라 '위조되지 않았음' 입니다. 주민번호·비밀번호를 payload 에 넣지 마세요.",
    "비밀키는 브라우저 밖으로 나가지 않습니다. 개발자도구 네트워크 탭을 열어 요청이 없음을 직접 확인할 수 있습니다.",
  ],
};

function ClaimTable({ payload }) {
  return (
    <table className="claim-table">
      <tbody>
        {Object.entries(payload).map(([k, v]) => {
          const isTime = TIME_CLAIMS.includes(k) && typeof v === "number";
          return (
            <tr key={k}>
              <th>
                {k}
                {CLAIM_MEANING[k] && <span className="claim-hint">{CLAIM_MEANING[k]}</span>}
              </th>
              <td>
                <span className="claim-val">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                {isTime && <span className="claim-kst">{unixToKst(v)}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * 키 입력 — 알고리즘에 따라 모양이 바뀐다.
 *
 * <p>HS* 는 글자 한 줄, RS·PS·ES 는 PEM 여러 줄이다. 같은 칸에 둘 다 받으면
 * "여기 뭘 넣으라는 거지" 가 되므로 아예 다른 칸을 보여 준다.
 */
function KeyInput({ algo, value, onChange, isB64, setIsB64, forSigning }) {
  const isPem = algo?.keyKind === "keypair";
  const [made, setMade] = useState(false);

  // 짧은 키로도 서명은 되지만 서버가 거부한다(jjwt WeakKeyException). 여기서 미리 말해 준다.
  const strength = isPem ? null : checkSecretStrength(algo?.key, value, isB64);
  // 두 해석을 **둘 다** 계산한다 — 고르지 않은 쪽도 보여 줘야 차이가 눈에 들어온다
  const asText = isPem ? null : checkSecretStrength(algo?.key, value, false);
  const asB64 = isPem ? null : checkSecretStrength(algo?.key, value, true);
  const required = requiredKeyBytes(algo?.key) || 32;

  if (isPem) {
    return (
      <textarea
        className="area code key-pem"
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={forSigning
          ? "-----BEGIN PRIVATE KEY-----\n(서명에는 개인키가 필요합니다)\n-----END PRIVATE KEY-----"
          : "-----BEGIN PUBLIC KEY-----\n(검증에는 공개키를 넣습니다. 개인키도 됩니다)\n-----END PUBLIC KEY-----"}
        spellCheck={false}
        aria-label={forSigning ? "개인키 PEM" : "공개키 PEM"}
      />
    );
  }

  return (
    <>
      <div className="secret-row">
        <input
          className="krw-input mono"
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setMade(false); }}
          placeholder={forSigning ? "서명에 쓸 비밀키" : "서버의 JWT_SECRET_KEY 값을 넣으세요"}
          spellCheck={false}
          aria-label="비밀키"
        />
        {forSigning && (
          <div className="secret-actions">
            {/* 검증할 때는 서버가 쓰는 키를 넣어야 한다. 아무 키나 만들면 당연히 안 맞는다. */}
            <button
              type="button"
              className="btn"
              onClick={() => { onChange(generateSecret(algo?.key || "HS256")); setMade(true); }}
              title={`${required}바이트 난수를 Base64URL 로 인코딩해 넣습니다`}
            >
              무작위로 만들기
            </button>
            {made && <span className="muted">{required}바이트 난수 · Base64URL</span>}
          </div>
        )}
      </div>

      {/* 체크박스 하나로 두면 고르지 않은 쪽이 안 보여서, 같은 문자열이 두 개의 다른 키가
          된다는 사실 자체가 감춰진다. 두 해석을 나란히 놓고 각각의 키 길이를 함께 보여 준다. */}
      {value.trim() && (
        <div className="key-modes">
          <p className="key-modes-q">키 해석 — 이 문자열에서 키 바이트를 얻는 방식</p>
          {[
            { on: isB64, pick: true, label: "Base64 디코드", code: "Decoders.BASE64.decode(secret)", s: asB64 },
            { on: !isB64, pick: false, label: "UTF-8 바이트", code: "secret.getBytes(UTF_8)", s: asText },
          ].map((m) => (
            <button
              key={m.label}
              type="button"
              className={`key-mode ${m.on ? "on" : ""}`}
              onClick={() => setIsB64(m.pick)}
              aria-pressed={m.on}
            >
              <span className="key-mode-head">
                <b>{m.label}</b>
                <em className="key-mode-bytes">
                  {m.s.bytes !== undefined ? `${m.s.bytes}바이트` : "디코드 불가"}
                </em>
              </span>
              <code>{m.code}</code>
            </button>
          ))}
          <p className="key-modes-note">
            서버의 키 로딩 방식과 일치시킵니다. 같은 문자열이라도 해석이 다르면 서명이 달라집니다.
          </p>
        </div>
      )}

      {/* 서버가 거부할 키를 미리 잡아 준다 */}
      {strength?.applies && !strength.ok && !strength.empty && (
        <div className="verify-result fail">
          <span className="material-icons">warning</span>
          <div>
            <b>비밀키가 너무 짧습니다.</b>
            <div className="verify-why">{strength.reason}</div>
          </div>
        </div>
      )}
      {strength?.applies && strength.ok && strength.bytes !== undefined && (
        <div className="key-hint">
          키 {strength.bytes}바이트 · {algo?.key} 요구치 {strength.required}바이트 충족
        </div>
      )}
    </>
  );
}

// ── 디코드 · 검증 ──────────────────────────────────────────
function DecodePanel() {
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [isB64, setIsB64] = useState(false);
  const [check, setCheck] = useState(null);

  const parsed = useMemo(() => {
    if (!token.trim()) return { ok: false, empty: true };
    try {
      return { ok: true, ...parseJwt(token) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [token]);

  // 서명 확인은 비동기(Web Crypto)라 결과를 상태로 받아야 한다. 다만 **효과 안에서 동기로
  // setState 하지 않는다**(react-hooks/set-state-in-effect — 규칙을 끄는 대신 구조를 바꾼다).
  // 무엇에 대한 결과인지를 key 로 함께 저장하고, 렌더 중에 지금 입력과 맞는지 판별한다.
  // 그래서 입력이 바뀐 직후 옛 결과가 잠깐 보이는 일도 없다.
  const checkKey = parsed.ok ? JSON.stringify([token, secret, isB64]) : null;

  useEffect(() => {
    if (!checkKey) return undefined;
    let alive = true;
    verifyJwt(token, secret, { secretIsBase64: isB64 })
      .then((r) => { if (alive) setCheck({ key: checkKey, ...r }); });
    return () => { alive = false; };
  }, [checkKey, token, secret, isB64]);

  const result = check?.key === checkKey ? check : null;

  // 어떤 키를 넣어야 하는지는 토큰이 말해 준다 — 사용자가 고를 일이 아니다
  const tokenAlgo = parsed.ok
    ? SIGN_ALGOS.find((a) => a.key === String(parsed.header?.alg || "").toUpperCase())
    : null;

  const expired = parsed.ok ? isExpired(parsed.payload) : null;

  // 서명이 안 맞을 때만 계산하면 되지만, 순수 함수라 렌더 중에 그냥 구한다
  const hints = parsed.ok && result && !result.valid && !result.needsKey
    ? signatureHints({ token, secret, secretIsBase64: isB64 })
    : [];

  return (
    <>
      <div className="split">
        {/* 넣는 것은 전부 왼쪽에 모은다 — 토큰과 키를 양쪽으로 나눠 두면
            "어디에 뭘 넣으라는 건지" 가 매번 헷갈린다. 오른쪽은 결과만 본다. */}
        <section className="panel">
          <div className="panel-head tools">
            <span>입력</span>
            <div className="panel-tools">
              <button type="button" className="btn" onClick={() => setToken(SAMPLE_TOKEN)}>예시 넣기</button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => { setToken(""); setSecret(""); }}
                disabled={!token && !secret}
              >
                비우기
              </button>
            </div>
          </div>

          <div className="field-stack">
            <div className="field">
              <label className="field-label" htmlFor="jwt-token">JWT 토큰</label>
              <textarea
                id="jwt-token"
                className="json-input mono short"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.xxxxx"
                spellCheck={false}
              />
            </div>

            <div className="field">
              <label className="field-label">
                {tokenAlgo?.keyKind === "keypair" ? "공개키 (PEM)" : "서명키"}
                {/* 어떤 키가 필요한지는 토큰의 alg 가 정한다 — 알려 주면 고를 일이 없다 */}
                {parsed.ok && tokenAlgo && <em className="field-note">{tokenAlgo.key}</em>}
              </label>
              {parsed.ok ? (
                <KeyInput
                  algo={tokenAlgo}
                  value={secret}
                  onChange={setSecret}
                  isB64={isB64}
                  setIsB64={setIsB64}
                  forSigning={false}
                />
              ) : (
                <p className="field-idle">토큰을 먼저 넣으면 어떤 키가 필요한지 알려 줍니다.</p>
              )}
            </div>

            {/* 서명 확인은 방금 넣은 키에 대한 대답이다 — 키 바로 아래에 둔다.
                반대쪽으로 보내면 키를 고칠 때마다 시선이 화면을 가로지른다. */}
            {parsed.ok && (
              <div className="verify-box tight">
                {/* 세 가지를 구분한다 — 맞다 / 틀리다 / 확인할 수 없다 */}
              {result?.valid && (
                <div className="verify-result ok">
                  <span className="material-icons">check_circle</span>
                  <div>
                    <b>서명이 맞습니다.</b> 이 키로 만들어진 토큰입니다.
                    {/* 서명이 맞는 것과 지금 써도 되는 것은 다른 문제다 */}
                    {result.claims?.problems?.length > 0 && (
                      <div className="verify-why">다만 {result.claims.problems.join(" ")}</div>
                    )}
                  </div>
                </div>
              )}
              {/* 키를 아직 안 넣은 것은 실패가 아니다. verifyJwt 가 주는 이름은 needsKey 다 —
                  예전엔 needsSecret 을 보느라 키만 비어도 "서명이 맞지 않습니다" 가 떴다. */}
              {result && !result.valid && result.needsKey && (
                <div className="verify-result idle">
                  <span className="material-icons">key</span>
                  <div>{result.reason}</div>
                </div>
              )}
              {result && !result.valid && !result.needsKey && (
                <div className={`verify-result ${result.unsupported ? "unknown" : "fail"}`}>
                  <span className="material-icons">{result.unsupported ? "help" : "cancel"}</span>
                  <div>
                    <b>{result.unsupported ? "확인할 수 없습니다." : "서명이 맞지 않습니다."}</b>
                    <div className="verify-why">{result.reason}</div>

                    {/* 값이 틀린 게 아니라 눈에 안 보이는 공백이 원인인 경우가 많다.
                        고쳐 주지는 않는다 — 공백이 진짜 키의 일부일 수도 있다. */}
                    {hints.length > 0 && (
                      <ul className="verify-hints">
                        {hints.map((h) => <li key={h}>{h}</li>)}
                      </ul>
                    )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 오른쪽은 읽어낸 내용만 — 토큰이 무엇을 담고 있나 */}
        <div className="stack">
          {!parsed.ok && !parsed.error && (
            <section className="panel">
              <div className="panel-head"><span>읽은 내용</span></div>
              <div className="panel-empty">토큰을 붙여넣으면 header 와 payload 를 여기서 읽어 줍니다.</div>
            </section>
          )}
          {parsed.error && <div className="notice error">{parsed.error}</div>}

          {parsed.ok && (
            <>
              {expired !== null && (
                <div className="jwt-status">
                  <span className={`status-badge ${expired ? "closed" : "continue"}`}>
                    {expired ? "만료됨" : "유효 (exp 기준)"}
                  </span>
                  <span className="jwt-note">시각만 본 결과다 — 서명은 왼쪽에서 따로 확인한다</span>
                </div>
              )}

              <section className="panel">
                <div className="panel-head tools">
                  <span>Header</span>
                  <div className="panel-tools"><CopyButton value={() => JSON.stringify(parsed.header, null, 2)} label="복사" /></div>
                </div>
                <pre className="mono-out">{JSON.stringify(parsed.header, null, 2)}</pre>
              </section>

              {/* 개발자도 헷갈리는 지점이다 — FAQ 에 묻어 두지 않고 payload 바로 위에 둔다.
                  "비밀키가 있어야 읽을 수 있다" 고 오해하면 payload 에 민감정보를 넣게 된다. */}
              <div className="notice warn">
                <b>이 내용은 누구나 읽을 수 있습니다.</b> 비밀키 없이도 보입니다 —
                Base64 로 인코딩만 되어 있고 암호화가 아닙니다.
                비밀키는 <b>위조되지 않았는지 확인</b>할 때만 씁니다.
                그래서 주민번호·비밀번호 같은 값을 여기 넣으면 안 됩니다.
              </div>

              <section className="panel">
                <div className="panel-head tools">
                  <span>Payload</span>
                  <div className="panel-tools"><CopyButton value={() => JSON.stringify(parsed.payload, null, 2)} label="복사" /></div>
                </div>
                <ClaimTable payload={parsed.payload} />
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── 생성 ───────────────────────────────────────────────────
function EncodePanel() {
  const [header, setHeader] = useState(SAMPLE_HEADER);
  const [payload, setPayload] = useState(SAMPLE_PAYLOAD);
  const [secret, setSecret] = useState("");
  // 새로 만드는 자리라 권장 구성을 기본으로 둔다 — 난수 바이트를 Base64 로 적고 서버가 디코드해 읽는 쪽.
  // (읽기 탭은 서버가 이미 정해 둔 것을 맞춰야 하므로 기본값을 따로 두지 않는다.)
  const [isB64, setIsB64] = useState(true);
  const [alg, setAlg] = useState("HS256");
  const [out, setOut] = useState({ key: null, token: "", error: null });
  const [pair, setPair] = useState(null);
  const [making, setMaking] = useState(false);

  const algo = SIGN_ALGOS.find((a) => a.key === alg);

  // 키쌍은 만들어 주는 편이 낫다 — openssl 을 꺼내 오게 하면 여기서 멈춘다
  const makePair = async () => {
    setMaking(true);
    try {
      const p = await generateKeyPair(alg);
      setPair(p);
      setSecret(p.privatePem);
    } catch (e) {
      setPair({ error: e.message });
    } finally {
      setMaking(false);
    }
  };

  // 헤더의 alg 를 화면 선택과 맞춰 준다 — 둘이 어긋나면 어느 쪽이 이겼는지 알 수 없다
  const pickAlg = (next) => {
    setAlg(next);
    // 키 종류가 바뀌면 들고 있던 키는 못 쓴다 — 남겨 두면 "왜 오류지" 가 된다
    const before = SIGN_ALGOS.find((a) => a.key === alg)?.keyKind;
    const after = SIGN_ALGOS.find((a) => a.key === next)?.keyKind;
    if (before !== after) { setSecret(""); setPair(null); }
    try {
      const h = JSON.parse(header);
      h.alg = next;
      setHeader(JSON.stringify(h, null, 3));
    } catch { /* 헤더가 아직 JSON 이 아니면 그대로 둔다 */ }
  };

  // JSON 파싱과 "비밀키가 있나" 는 동기라 렌더 중에 끝낸다. 효과는 **서명 하나만** 맡는다
  // — 그래야 효과 안에서 동기 setState 를 하지 않는다(react-hooks/set-state-in-effect).
  const ready = useMemo(() => {
    let h;
    let p;
    try { h = JSON.parse(header); } catch { return { error: "Header 가 올바른 JSON 이 아닙니다." }; }
    try { p = JSON.parse(payload); } catch { return { error: "Payload 가 올바른 JSON 이 아닙니다." }; }
    if (!secret) return { needsSecret: true };
    return { ok: true, header: h, payload: p };
  }, [header, payload, secret]);

  // 무엇에 대한 결과인지 key 로 함께 저장한다 — 입력이 바뀐 뒤 옛 토큰이 남지 않는다
  const signKey = ready.ok ? JSON.stringify([header, payload, secret, alg, isB64]) : null;

  useEffect(() => {
    if (!signKey) return undefined;
    let alive = true;
    signJwt({ header: ready.header, payload: ready.payload, key: secret, alg, secretIsBase64: isB64 })
      .then((token) => { if (alive) setOut({ key: signKey, token, error: null }); })
      .catch((e) => { if (alive) setOut({ key: signKey, token: "", error: e.message }); });
    return () => { alive = false; };
  }, [signKey, ready, secret, alg, isB64]);

  const signed = out.key === signKey ? out : { token: "", error: null };

  /** exp 를 "지금부터 n분 뒤" 로 넣어 준다 — Unix 초를 손으로 계산할 사람은 없다 */
  const setExp = (minutes) => {
    try {
      const p = JSON.parse(payload);
      p.exp = Math.floor(Date.now() / 1000) + minutes * 60;
      setPayload(JSON.stringify(p, null, 3));
    } catch { /* JSON 이 아니면 아무것도 하지 않는다 */ }
  };

  return (
    <>
      <div className="split">
        <section className="panel">
          <div className="panel-head tools">
            <span>Header</span>
            <div className="panel-tools">
              <label className="select-label">
                알고리즘
                <select value={alg} onChange={(e) => pickAlg(e.target.value)}>
                  {SIGN_ALGOS.map((a) => <option key={a.key} value={a.key}>{a.key}</option>)}
                </select>
              </label>
            </div>
          </div>
          <textarea className="json-input mono short" value={header} onChange={(e) => setHeader(e.target.value)} spellCheck={false} aria-label="Header JSON" />

          <div className="panel-head tools">
            <span>Payload</span>
            <div className="panel-tools">
              <button type="button" className="btn" onClick={() => setExp(60)}>exp 1시간</button>
              <button type="button" className="btn" onClick={() => setExp(60 * 24)}>1일</button>
            </div>
          </div>
          {/* 아래에 비밀키 칸이 이어지므로 기본 높이의 절반만 쓴다 — 키가 화면 밖으로 밀리면 안 된다 */}
          <textarea className="json-input mono mid" value={payload} onChange={(e) => setPayload(e.target.value)} spellCheck={false} aria-label="Payload JSON" />

          {/* 서명키도 입력이다 — 읽기 탭과 같은 자리에 둔다. 결과 쪽에 두면
              "만들어진 토큰" 패널 안에서 값을 고치게 되어 방향이 뒤집힌다. */}
          <div className="panel-head tools">
            <span>{algo?.keyKind === "keypair" ? "개인키 (PEM)" : "서명에 쓸 비밀키"}</span>
            <div className="panel-tools">
              <em className="tag">{alg}</em>
            </div>
          </div>
          <div className="field-stack tight">
            <KeyInput
              algo={algo}
              value={secret}
              onChange={setSecret}
              isB64={isB64}
              setIsB64={setIsB64}
              forSigning
            />
            {algo?.keyKind === "keypair" && (
              <div className="key-actions">
                <button type="button" className="btn" onClick={makePair} disabled={making}>
                  {making ? "만드는 중…" : "키쌍 만들기"}
                </button>
                {pair?.publicPem && (
                  <>
                    <span className="muted">검증에는 아래 공개키를 씁니다</span>
                    <CopyButton value={() => pair.publicPem} label="공개키 복사" />
                  </>
                )}
                {pair?.error && <span className="muted">{pair.error}</span>}
              </div>
            )}
            {pair?.publicPem && (
              <textarea className="area code key-pem readonly" rows={4} value={pair.publicPem} readOnly spellCheck={false} aria-label="공개키 PEM" />
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head tools">
            <span>만들어진 토큰</span>
            <div className="panel-tools">
              {signed.token && <CopyButton value={() => signed.token} label="복사" />}
            </div>
          </div>
          {ready.error && <div className="notice error">{ready.error}</div>}
          {signed.error && <div className="notice error">{signed.error}</div>}
          {ready.needsSecret && <div className="panel-empty">왼쪽에 비밀키를 넣으면 토큰을 만듭니다.</div>}
          {signed.token && (
            <>
              <textarea className="json-input mono readonly tall" value={signed.token} readOnly spellCheck={false} aria-label="만들어진 토큰" />
            </>
          )}
        </section>
      </div>
    </>
  );
}

export function JwtPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });
  const [tab, setTab] = useState("decode");

  return (
    <article className="tool-page">
      <ToolHeader title="JWT 디코더 · 생성기" />

      <div className="toolbar">
        <div className="seg">
          <button type="button" className={tab === "decode" ? "on" : ""} onClick={() => setTab("decode")}>토큰 읽기</button>
          <button type="button" className={tab === "encode" ? "on" : ""} onClick={() => setTab("encode")}>토큰 만들기</button>
        </div>
        <span className="muted">비밀키는 브라우저 밖으로 나가지 않습니다</span>
      </div>

      {tab === "decode" ? <DecodePanel /> : <EncodePanel />}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
