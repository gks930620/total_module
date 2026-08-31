// 색상 변환 · WCAG 명암비 검사 — 하는 일이 둘이라 탭으로 나눈다(JWT 의 읽기/만들기와 같은 구조).
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { parseColor, toHex, toRgbString, toHslString, toHsv, contrastRatio, wcagLevel, contrastAdvice, luminance } from "../lib/color.js";

const tool = getToolBySlug("color");

const GUIDE = {
  intro: "위 탭에서 '색상 변환' 과 '명암비 검사' 중 하나를 고릅니다. 변환은 어떤 표기로 넣어도 HEX·RGB·HSL·HSV 로 한꺼번에 바꿔 주고, 명암비는 글자색과 배경색을 함께 넣어 WCAG 기준을 통과하는지 계산하며 실제 글자를 그 조합으로 그려 보여 줍니다.",
  screen: {
    layout: "stack",
    left: { head: "탭: 색상 변환 / 명암비 검사 · 색상 값", body: "#3b82f6 · rgb(59,130,246) · hsl(217,91%,60%) · navy" },
    right: { head: "표기 변환표 또는 명암비 판정", body: "표기마다 복사 버튼 · 조합을 눈으로 확인" },
    caption: "고른 색은 탭을 옮겨도 그대로 따라갑니다 — 변환하다 바로 대비를 볼 수 있습니다.",
  },
  example: {
    in: "#3b82f6  (배경 #ffffff)",
    out: `RGB     rgb(59, 130, 246)
HSL     hsl(217, 91%, 60%)
명암비  3.68 : 1
판정    AA(큰 글씨)`,
  },
  notes: [
    "#RGB · #RRGGBB · #RRGGBBAA · rgb() · rgba() · hsl() · hsla() 와 red·navy 같은 색 이름을 읽습니다. # 을 빼고 hex 만 써도 됩니다.",
    "명암비는 글자색과 배경색이 얼마나 뚜렷하게 갈리는지를 잰 숫자입니다 — 흰 바탕에 검은 글자가 21:1(최대), 같은 색끼리면 1:1(안 보임)입니다.",
    "웹 접근성 기준(WCAG 2.1)은 본문 글자에 4.5:1 이상을 요구합니다. 7:1 이면 AAA, 큰 글씨(굵은 19px 이상)는 3:1 이면 통과입니다. 옅은 회색 글자가 흔히 여기서 걸립니다.",
    "쓰는 법은 간단합니다 — 글자색과 배경색을 넣고 아래 미리보기가 읽히는지 보면 됩니다. 숫자가 4.5 미만이면 글자색을 더 진하게 하거나 배경을 더 밝게 하세요.",
    "HSL 로 바꿨다 되돌리면 채널당 1~2 차이가 날 수 있습니다. CSS 관례대로 hsl() 값을 정수로 반올림하기 때문이니, 무손실이 필요하면 hex 나 rgb() 를 쓰세요.",
    "알파도 읽습니다 — 8자리 hex 와 rgba()·hsla() 의 알파를 인식하고 1 미만이면 출력에도 반영합니다.",
  ],
};

const SWATCHES = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#0f172a", "#64748b", "#ffffff"];

/**
 * 색 하나를 받는 줄 — 선택기와 입력칸을 한 줄에 둔다.
 *
 * <p>선택기를 바깥에 두면 라벨 높이만큼 어긋나고, 높이를 px 로 맞춰도
 * 입력칸은 글꼴 크기에 따라 달라져서 또 어긋난다. stretch 로 따라가게 한다.
 */
function ColorField({ label, value, onChange, color, placeholder }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="color-input">
        <input
          type="color"
          className="color-picker"
          value={color.ok ? toHex({ ...color, a: 1 }) : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} 선택기`}
        />
        <input
          className="krw-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

/** 한 색을 여러 표기로 */
function ConvertPanel({ input, setInput, color }) {
  return (
    <>
      <ColorField
        label="색상 값"
        value={input}
        onChange={setInput}
        color={color}
        placeholder="#3b82f6 · rgb(59,130,246) · hsl(217,91%,60%) · navy"
      />

      <div className="chip-row">
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            className="swatch"
            style={{ background: s }}
            onClick={() => setInput(s)}
            aria-label={s}
            title={s}
          />
        ))}
      </div>

      {!color.ok ? (
        <div className="notice error">{color.reason}</div>
      ) : (
        <>
          <div className="color-preview" style={{ background: toHex(color) }} />

          <div className="kv-card">
            {[
              ["HEX", toHex(color)],
              ["RGB", toRgbString(color)],
              ["HSL", toHslString(color)],
              ["HSV", (() => { const v = toHsv(color); return `hsv(${v.h}, ${v.s}%, ${v.v}%)`; })()],
              ["CSS 변수", `--color: ${toHex(color)};`],
              ["상대 휘도", luminance(color).toFixed(4)],
            ].map(([k, v]) => (
              <div className="kv-row" key={k}>
                <span className="kv-label">{k}</span>
                <span className="kv-value mono">{v}</span>
                <CopyButton value={() => String(v)} label="복사" />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** 두 색의 대비가 읽히는 수준인가 */
function ContrastPanel({ input, setInput, color }) {
  const [bg, setBg] = useState("#ffffff");
  const bgColor = useMemo(() => parseColor(bg), [bg]);
  const ratio = color.ok && bgColor.ok ? contrastRatio(color, bgColor) : null;

  return (
    <>
      <div className="split">
        <ColorField label="글자색" value={input} onChange={setInput} color={color} placeholder="#3b82f6 · navy" />
        <ColorField label="배경색" value={bg} onChange={setBg} color={bgColor} placeholder="#ffffff · white" />
      </div>

      {!color.ok && <div className="notice error">글자색: {color.reason}</div>}
      {!bgColor.ok && <div className="notice error">배경색: {bgColor.reason}</div>}

      {ratio !== null && (
        <>
          <div className="contrast-preview" style={{ background: toHex(bgColor), color: toHex(color) }}>
            가나다라 Sample Text 123 — 이 조합이 읽히는지 확인하세요.
          </div>
          {/* 등급 이름만으로는 뭘 고쳐야 할지 모른다 — 한 줄로 풀어 준다 */}
          <div className="statusbar">
            <span>명암비 <b>{ratio.toFixed(2)} : 1</b></span>
            <span className={`tag ${ratio >= 4.5 ? "ok" : "warn"}`}>{wcagLevel(ratio)}</span>
            <span>{contrastAdvice(ratio)}</span>
          </div>
          <p className="hint">
            1 에 가까울수록 안 보이고 21 이 최대입니다(흰 배경 + 검은 글자).
            본문 글자는 <b>4.5</b> 이상, 큰 글씨는 <b>3</b> 이상, AAA 는 <b>7</b> 이상이 기준입니다.
          </p>
        </>
      )}
    </>
  );
}

export function ColorPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [tab, setTab] = useState("convert");
  // 색은 두 탭이 함께 쓴다 — 변환하다 바로 대비를 보는 흐름이 자연스럽다
  const [input, setInput] = useState("#3b82f6");
  const color = useMemo(() => parseColor(input), [input]);

  return (
    <article className="tool-page">
      <ToolHeader title="색상 변환 · 명암비 검사" description="HEX·RGB·HSL 표기를 상호 변환하고 WCAG 명암비를 검사합니다." />

      <div className="toolbar">
        <div className="seg">
          <button type="button" className={tab === "convert" ? "on" : ""} onClick={() => setTab("convert")}>색상 변환</button>
          <button type="button" className={tab === "contrast" ? "on" : ""} onClick={() => setTab("contrast")}>명암비 검사</button>
        </div>
      </div>

      {tab === "convert"
        ? <ConvertPanel input={input} setInput={setInput} color={color} />
        : <ContrastPanel input={input} setInput={setInput} color={color} />}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
