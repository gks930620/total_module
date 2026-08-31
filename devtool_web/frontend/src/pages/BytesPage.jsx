// 바이트 크기 변환
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { parseSize, convertSize } from "../lib/bytes.js";

const tool = getToolBySlug("bytes");

const GUIDE = {
  intro: "숫자를 적고 단위를 고르면 모든 크기 단위로 한 번에 환산합니다. KB(1000 단위)와 KiB(1024 단위)를 두 표로 나란히 놓아 어느 기준으로 읽은 값인지 헷갈리지 않습니다 — 500GB 디스크가 465GiB 로 보이는 이유가 여기 있습니다.",
  screen: {
    layout: "stack",
    left: { head: "크기 · 단위 고르기", body: "숫자만 적고 단위는 목록에서" },
    right: { head: "KB(1000) · KiB(1024) 두 표", body: "모든 단위로 동시에 환산 · 바이트 복사" },
    caption: "위 칸에 적으면 아래 두 표가 바로 바뀝니다.",
  },
  example: {
    in: "1024 B",
    out: `1,024 바이트
KB   1.024   (1000 단위)
KiB  1       (1024 단위)`,
  },
  notes: [
    "KB 는 국제단위계(SI)로 1,000 바이트, KiB 는 IEC 2진 접두사로 1,024 바이트입니다. 1024 바이트를 넣으면 KB 는 1.024, KiB 는 1 로 나옵니다.",
    "윈도우 탐색기는 1024 로 세면서 'KB' 라고 적습니다 — KiB 를 처음 보는 이유가 이것입니다. 표준 표기는 KiB 가 맞고, 실제 문서·설정에서도 그렇게 씁니다.",
    "'500GB 디스크가 465GB 로 보인다' 는 건 제조사가 1000 단위(500GB)로 팔고 윈도우가 1024 단위로 읽어 465GiB 라고 적기 때문입니다.",
    "자바 -Xmx512m, 레디스 maxmemory 처럼 k·m·g 로 짧게 쓴 설정값은 관례상 1024 기준입니다 — 그런 값은 KiB·MiB·GiB 로 고르면 됩니다.",
    "1바이트=8비트 기준으로 비트 수도 함께 보여 줍니다. 네트워크 대역폭(Mbps)은 비트 단위입니다.",
  ],
};

/**
 * 고를 수 있는 단위. 정식 이름(KB / KiB)을 그대로 쓴다.
 *
 * <p>윈도우 탐색기가 1024 를 세면서 "KB" 라고 적는 탓에 KiB 를 처음 보는 사람이 많지만,
 * 감춰 버리면 실제 문서·설정에서 KiB 를 마주쳤을 때 못 알아본다.
 * 대신 묶음 제목에 어디서 쓰는 값인지 적어 둔다.
 */
const UNIT_GROUPS = [
  { label: "1000 단위 (SI) — 디스크 제조사·네트워크", units: ["B", "KB", "MB", "GB", "TB", "PB"] },
  { label: "1024 단위 (IEC) — 윈도우 탐색기·OS·JVM", units: ["KiB", "MiB", "GiB", "TiB", "PiB"] },
];

const fmt = (n) => {
  if (n === 0) return "0";
  if (n >= 1 && n < 1e15) return Number(n.toFixed(6)).toLocaleString("ko-KR", { maximumFractionDigits: 6 });
  return n.toExponential(4);
};

export function BytesPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  // 숫자와 단위를 따로 받는다 — 한 칸에 "1.5 GiB" 처럼 적게 하면
  // 어떤 단위를 쓸 수 있는지 화면만 봐서는 알 수 없다.
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState("GB");

  const parsed = useMemo(() => parseSize(`${amount} ${unit}`), [amount, unit]);
  const result = useMemo(() => (parsed.ok ? convertSize(parsed.bytes) : null), [parsed]);

  return (
    <article className="tool-page">
      <ToolHeader title="바이트 크기 변환" description="KB(1000 단위)와 KiB(1024 단위)를 구분해 정확히 환산합니다." />

      <div className="toolbar">
        <div className="field grow">
          <span>크기</span>
          <input className="krw-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1.5" inputMode="decimal" spellCheck={false} />
        </div>
        <label className="select-label">
          단위
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNIT_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.units.map((u) => <option key={u} value={u}>{u}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {!parsed.ok ? (
        <div className="notice error">{parsed.reason}</div>
      ) : (
        <>
          <div className="statusbar">
            <span>= <b>{result.bytes.toLocaleString("ko-KR")}</b> 바이트</span>
            <span>{result.bits.toLocaleString("ko-KR")} 비트</span>
            <CopyButton value={() => String(result.bytes)} label="바이트 복사" />
          </div>

          <div className="split">
            {/* KB(1000) 를 먼저 놓는다 — 사람들이 쓰고 찾는 단위가 이쪽이다.
                KiB(1024) 는 OS·JVM 이 쓰는 값이라 옆에 나란히 둔다. */}
            <div className="panel">
              <div className="panel-head"><span>KB · MB · GB — 1000 단위 (디스크 제조사·네트워크)</span></div>
              <div className="kv-card flat">
                {Object.entries(result.decimal).map(([unit, value]) => (
                  <div className="kv-row" key={unit}>
                    <span className="kv-label">{unit}</span>
                    <span className="kv-value mono">{fmt(value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><span>KiB · MiB · GiB — 1024 단위 (윈도우 탐색기·OS·JVM)</span></div>
              <div className="kv-card flat">
                {Object.entries(result.binary).map(([unit, value]) => (
                  <div className="kv-row" key={unit}>
                    <span className="kv-label">{unit}</span>
                    <span className="kv-value mono">{fmt(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="hint">
            사람이 읽는 표기: <code className="chip-inline">{result.humanDecimal}</code> (1000 단위) ·{" "}
            <code className="chip-inline">{result.humanBinary}</code> (1024 단위)
          </p>
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
