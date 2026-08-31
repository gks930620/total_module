// IP · CIDR 서브넷 계산기
import { useState, useMemo } from "react";
import { ToolHeader } from "../components/ToolHeader.jsx";
import { ToolGuide } from "../components/ToolGuide.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { useMeta } from "../lib/useMeta.js";
import { getToolBySlug } from "../lib/tools.js";
import { parseCidr, containsIp, splitSubnets } from "../lib/cidr.js";

const tool = getToolBySlug("cidr");

const GUIDE = {
  intro: "CIDR 표기를 넣으면 네트워크·브로드캐스트 주소, 쓸 수 있는 호스트 범위와 개수, 넷마스크·와일드카드를 한 번에 계산합니다. 그 아래에서 특정 IP 가 이 대역에 드는지 확인하고, 더 작은 프리픽스로 쪼갠 결과도 표로 볼 수 있습니다.",
  screen: {
    layout: "stack",
    left: { head: "CIDR 또는 IP/넷마스크", body: "192.168.0.0/24 · 자주 쓰는 대역은 위 칩으로" },
    right: { head: "계산 결과 → 포함 여부 확인 → 서브넷 분할", body: "항목마다 복사 버튼" },
    caption: "위에 대역을 적으면 아래가 전부 다시 계산됩니다.",
  },
  example: {
    in: "192.168.0.77/24",
    out: `네트워크        192.168.0.0
브로드캐스트    192.168.0.255
호스트 범위     192.168.0.1 ~ .254
넷마스크        255.255.255.0
사용 가능 호스트 254`,
  },
  notes: [
    "호스트 주소를 그대로 넣어도 됩니다 — 192.168.0.77/24 를 넣으면 그 주소가 속한 192.168.0.0/24 를 찾아 계산합니다.",
    "사용 가능 호스트가 전체보다 2개 적은 이유는 네트워크 주소와 브로드캐스트 주소를 뺐기 때문입니다. /31 은 점대점 링크용으로 둘 다 쓰고(RFC 3021), /32 는 호스트 하나를 뜻합니다.",
    "와일드카드 마스크는 넷마스크의 비트를 뒤집은 값으로, 시스코 ACL 과 일부 방화벽 규칙에서 씁니다.",
    "10.0.0.0/8 · 172.16.0.0/12 · 192.168.0.0/16 은 사설 대역(RFC 1918)입니다. 루프백·링크로컬·CGNAT 도 구분해 알려 줍니다.",
    "서브넷 분할표는 256개까지만 보여 줍니다.",
  ],
};

const PRESETS = ["192.168.0.0/24", "10.0.0.0/8", "172.16.0.0/12", "0.0.0.0/0", "127.0.0.1/32"];

export function CidrPage() {
  useMeta({ title: tool.title, description: tool.metaDescription, path: tool.path, keywords: tool.keywords });

  const [input, setInput] = useState("192.168.0.0/24");
  const [testIp, setTestIp] = useState("");
  const [splitPrefix, setSplitPrefix] = useState(26);

  const result = useMemo(() => parseCidr(input), [input]);
  const contains = useMemo(
    () => (testIp.trim() && result.ok ? containsIp(input, testIp) : null),
    [input, testIp, result.ok]
  );
  const subnets = useMemo(
    () => (result.ok && splitPrefix > result.prefix ? splitSubnets(input, splitPrefix) : []),
    [input, splitPrefix, result]
  );

  const update = (v) => {
    setInput(v); };

  return (
    <article className="tool-page">
      <ToolHeader title="IP · 서브넷 계산기" description="CIDR 표기로 네트워크 범위·호스트 개수·넷마스크를 계산합니다." />

      <div className="chip-row">
        {PRESETS.map((p) => (
          <button key={p} type="button" className="chip" onClick={() => update(p)}>{p}</button>
        ))}
      </div>

      <div className="field">
        <span>CIDR 또는 IP/넷마스크</span>
        <input className="krw-input" value={input} onChange={(e) => update(e.target.value)} placeholder="192.168.0.0/24" spellCheck={false} />
      </div>

      {!result.ok ? (
        <div className="notice error">{result.reason}</div>
      ) : (
        <>
          <div className="statusbar">
            <span>{result.cidr}</span>
            <span className={`tag ${result.isPrivate ? "" : "warn"}`}>{result.kind}</span>
            <CopyButton value={() => result.cidr} label="CIDR 복사" />
          </div>

          <div className="kv-card">
            {[
              ["네트워크 주소", result.network],
              ["브로드캐스트", result.broadcast],
              ["첫 호스트", result.firstHost],
              ["마지막 호스트", result.lastHost],
              ["넷마스크", result.netmask],
              ["와일드카드", result.wildcard],
              ["프리픽스", `/${result.prefix}`],
              ["전체 주소 수", result.totalAddresses.toLocaleString("ko-KR")],
              ["사용 가능 호스트", result.usableHosts.toLocaleString("ko-KR")],
            ].map(([k, v]) => (
              <div className="kv-row" key={k}>
                <span className="kv-label">{k}</span>
                <span className="kv-value mono">{v}</span>
                <CopyButton value={() => String(v)} label="복사" />
              </div>
            ))}
          </div>

          <h2 className="sub-heading">이 대역에 포함되는지 확인</h2>
          <div className="field">
            <span>확인할 IP</span>
            <input className="krw-input" value={testIp} onChange={(e) => setTestIp(e.target.value)} placeholder="192.168.0.55" spellCheck={false} />
          </div>
          {contains !== null && (
            <div className={`notice ${contains ? "ok" : "warn"}`}>
              {testIp} 는 {result.cidr} 대역에 <strong>{contains ? "포함됩니다" : "포함되지 않습니다"}</strong>.
            </div>
          )}

          <h2 className="sub-heading">
            서브넷 분할
            <label className="select-label inline">
              프리픽스
              <select value={splitPrefix} onChange={(e) => setSplitPrefix(Number(e.target.value))}>
                {Array.from({ length: 32 }, (_, i) => i + 1)
                  .filter((p) => p > result.prefix)
                  .map((p) => <option key={p} value={p}>/{p}</option>)}
              </select>
            </label>
          </h2>

          {subnets.length === 0 ? (
            <p className="hint">현재 프리픽스보다 큰 값을 선택하면 분할 결과가 나옵니다.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>#</th><th>서브넷</th><th>브로드캐스트</th><th>호스트</th></tr></thead>
                  <tbody>
                    {subnets.map((s, i) => (
                      <tr key={s.cidr}>
                        <td className="num">{i + 1}</td>
                        <td className="mono">{s.cidr}</td>
                        <td className="mono">{s.broadcast}</td>
                        <td>{s.usableHosts.toLocaleString("ko-KR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {subnets.length === 256 && <p className="hint">표시 상한(256개)에 도달해 일부만 보여 줍니다.</p>}
            </>
          )}
        </>
      )}

      <ToolGuide {...GUIDE} />
    </article>
  );
}
