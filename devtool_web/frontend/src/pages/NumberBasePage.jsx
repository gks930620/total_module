// 진법 변환 · 비트 연산 — 하는 일이 둘로 갈려서 탭으로 나눈다(JWT 의 읽기/만들기와 같은 구조).
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { parseNumber, convertAllBases, toBitString, toSigned, bitwise, BIT_WIDTHS, BITWISE_OPS } from "../lib/numberBase.js";

const tool = getToolBySlug("number-base");

const GUIDE = {
  intro: "위 탭에서 '진법 변환' 과 '비트 연산' 중 하나를 고릅니다. 변환은 값 하나를 2·8·10·16진수로 한꺼번에 바꾸고 고른 비트폭 기준의 비트 배열과 부호 있는 값까지 보여 주며, 비트 연산은 두 값을 넣어 AND·OR·XOR·시프트 결과를 비트로 확인합니다.",
  screen: {
    layout: "stack",
    left: { head: "탭: 진법 변환 / 비트 연산 · 비트폭", body: "255 · 0xff · 0b1010" },
    right: { head: "진법별 변환 또는 비트 연산 결과", body: "값마다 복사 버튼" },
    caption: "비트폭은 두 탭이 함께 씁니다 — 그릇 크기를 정하는 값이라서입니다.",
  },
  example: {
    in: "255",
    out: `2진수   11111111
8진수   377
16진수  ff
비트(16)  0000 0000 1111 1111`,
  },
  notes: [
    "입력 진법은 직접 고릅니다(기본 10진수). 0x(16진) · 0b(2진) · 0o(8진) 접두사를 붙여 넣어도 되지만, 고른 진법과 접두사가 다르면 그렇다고 알려 줍니다.",
    "내부적으로 BigInt 를 쓰므로 64비트를 넘어도 자릿수 제한 없이 정확합니다 — 자바스크립트 Number 의 정밀도 손실이 없습니다.",
    "비트폭은 '몇 칸짜리 그릇에 담을 것인가' 입니다 — byte 8 · short 16 · int 32 · long 64. 그릇이 정해져야 맨 앞 비트가 어디인지 정해지고, 그래야 부호 해석이 됩니다.",
    "'부호 있는 값' 은 맨 앞 비트를 부호로 읽은 결과입니다(2의 보수). 맨 앞이 0 이면 원래 값과 같고, 1 이면 음수가 됩니다 — 8비트에서 200 은 -56, 32비트에서 0xFFFFFFFF 는 -1 입니다.",
    "1_000_000 처럼 밑줄·공백·콤마가 섞여 있어도 무시하고 읽습니다. 코드에서 복사한 값을 그대로 붙여넣으세요.",
    "AND·OR·XOR 는 두 값을 비트끼리 맞대어 계산합니다. 시프트는 두 번째 값이 비트 패턴이 아니라 '몇 칸 밀지' 하는 개수라 입력칸이 따로 나옵니다 — 0b1100 을 왼쪽 2칸 밀면 0011 0000(48)입니다.",
    "NOT 은 A 하나만 씁니다. 결과는 언제나 고른 비트폭으로 잘라 보여 줍니다.",
  ],
};

/** 값 하나를 여러 진법으로 */
function ConvertPanel({ bitWidth }) {
  const [input, setInput] = useState("255");
  // 진법은 늘 명시한다. "자동" 을 두면 지금 무엇으로 읽히는지 화면만 봐서는 알 수 없다.
  const [base, setBase] = useState(10);

  const parsed = useMemo(() => parseNumber(input, base), [input, base]);
  const bases = parsed.ok ? convertAllBases(parsed.value) : null;

  return (
    <>
      <div className="toolbar">
        <label className="select-label">
          입력 진법
          <select value={base} onChange={(e) => setBase(Number(e.target.value))}>
            <option value={10}>10진수</option>
            <option value={2}>2진수</option>
            <option value={8}>8진수</option>
            <option value={16}>16진수</option>
          </select>
        </label>
      </div>

      <div className="field">
        <span>값</span>
        <input className="krw-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="255" spellCheck={false} />
      </div>

      {!parsed.ok ? (
        <div className="notice error">{parsed.reason}</div>
      ) : (
        <div className="kv-card">
          {[
            ["2진수", bases.bin],
            ["8진수", bases.oct],
            ["10진수", bases.dec],
            ["16진수", bases.hex],
            ["16진수 (대문자)", bases.hex.toUpperCase()],
            [`${bitWidth}비트 표현`, toBitString(parsed.value, bitWidth)],
            [`${bitWidth}비트 부호 있는 값`, String(toSigned(parsed.value, bitWidth))],
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="kv-label">{k}</span>
              <span className="kv-value mono break">{v}</span>
              <CopyButton value={() => v} label="복사" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** 두 값을 비트로 계산 */
function BitwisePanel({ bitWidth }) {
  const [opA, setOpA] = useState("13245");
  // B 는 A 와 다른 값이어야 한다 — 같으면 AND·OR 가 자기 자신, XOR 는 0 이라
  // 첫 화면에서 연산이 아무 일도 안 하는 것처럼 보인다. 4080 은 0000 1111 1111 0000 로
  // 마스크 모양이 또렷해 세 연산의 차이가 비트에서 바로 보인다.
  const [opB, setOpB] = useState("4080");
  // 시프트의 두 번째 값은 비트 패턴이 아니라 **몇 칸 밀지** 하는 개수다.
  // 같은 칸에 받으면 0b1010 이 "10칸" 으로 읽혀 무슨 일이 일어난 건지 알 수 없다.
  const [shiftBy, setShiftBy] = useState("2");
  const [op, setOp] = useState("and");

  const isShift = op === "shl" || op === "shr";
  const needsB = op !== "not";

  const a = useMemo(() => parseNumber(opA), [opA]);
  const b = useMemo(() => parseNumber(opB), [opB]);
  const shift = useMemo(() => {
    const n = Number(String(shiftBy).trim());
    return Number.isInteger(n) && n >= 0 && n <= bitWidth ? BigInt(n) : null;
  }, [shiftBy, bitWidth]);

  const opResult = useMemo(() => {
    if (!a.ok) return null;
    if (isShift) return shift === null ? null : bitwise(op, a.value, shift, bitWidth);
    if (needsB && !b.ok) return null;
    return bitwise(op, a.value, b.ok ? b.value : 0n, bitWidth);
  }, [a, b, op, isShift, needsB, shift, bitWidth]);

  return (
    <>
      {/* 폭을 고정한다 — A 가 늘어나면 NOT 을 골랐을 때 연산 select 가 오른쪽으로 밀려
          눈이 매번 다시 찾아야 한다. 어느 연산이든 A · 연산 · (B|몇 칸) 자리가 그대로다. */}
      <div className="toolbar bit-row">
        <div className="field">
          <span>A</span>
          <input className="krw-input" value={opA} onChange={(e) => setOpA(e.target.value)} spellCheck={false} />
        </div>
        <label className="select-label">
          연산
          <select value={op} onChange={(e) => setOp(e.target.value)}>
            {BITWISE_OPS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        {isShift && (
          <div className="field count">
            <span>몇 칸</span>
            <input className="krw-input small" value={shiftBy} onChange={(e) => setShiftBy(e.target.value)} inputMode="numeric" />
          </div>
        )}
        {needsB && !isShift && (
          <div className="field">
            <span>B</span>
            <input className="krw-input" value={opB} onChange={(e) => setOpB(e.target.value)} spellCheck={false} />
          </div>
        )}
      </div>

      {opResult !== null ? (
        <div className="kv-card">
          <div className="kv-row"><span className="kv-label">A</span><span className="kv-value mono">{toBitString(a.value, bitWidth)}</span></div>
          {isShift && (
            <div className="kv-row">
              <span className="kv-label">{op === "shl" ? "왼쪽으로" : "오른쪽으로"}</span>
              <span className="kv-value">{String(shift)}칸</span>
            </div>
          )}
          {needsB && !isShift && <div className="kv-row"><span className="kv-label">B</span><span className="kv-value mono">{toBitString(b.value, bitWidth)}</span></div>}
          <div className="kv-row highlight">
            <span className="kv-label">결과</span>
            <span className="kv-value mono">{toBitString(opResult, bitWidth)}</span>
            <CopyButton value={() => opResult.toString()} label="복사" />
          </div>
          <div className="kv-row"><span className="kv-label">10진수 / 16진수</span><span className="kv-value mono">{opResult.toString(10)} / 0x{opResult.toString(16)}</span></div>
        </div>
      ) : (
        <div className="notice error">
          {isShift
            ? `'몇 칸' 은 0 이상 ${bitWidth} 이하의 정수여야 합니다.`
            : "피연산자를 해석할 수 없습니다. 예) 0b1100, 0xff, 12"}
        </div>
      )}
    </>
  );
}

export function NumberBasePage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [tab, setTab] = useState("convert");
  // 비트폭은 두 탭이 함께 쓴다 — "몇 칸짜리 그릇인가" 는 어느 쪽에서든 같은 값이다
  const [bitWidth, setBitWidth] = useState(32);

  return (
    <article className="tool-page">
      <ToolHeader title="진법 변환 · 비트 연산" description="2·8·10·16진수를 변환하고 AND·OR·XOR·시프트를 계산합니다." />

      <div className="toolbar">
        <div className="seg">
          <button type="button" className={tab === "convert" ? "on" : ""} onClick={() => setTab("convert")}>진법 변환</button>
          <button type="button" className={tab === "bitwise" ? "on" : ""} onClick={() => setTab("bitwise")}>비트 연산</button>
        </div>
      </div>

      {/* 비트폭은 탭과 한 줄에 두면 무엇에 걸리는 설정인지 흐려진다 — 줄을 바꿔 따로 놓는다 */}
      <div className="toolbar">
        <label className="select-label">
          비트폭
          <select value={bitWidth} onChange={(e) => setBitWidth(Number(e.target.value))}>
            {BIT_WIDTHS.map((w) => <option key={w} value={w}>{w}비트</option>)}
          </select>
        </label>
        <span className="muted">byte 8 · short 16 · int 32 · long 64</span>
      </div>

      {tab === "convert" ? <ConvertPanel bitWidth={bitWidth} /> : <BitwisePanel bitWidth={bitWidth} />}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
