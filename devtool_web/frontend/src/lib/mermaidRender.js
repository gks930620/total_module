// mermaid 를 **동적으로만** 불러오는 얇은 껍데기 (pdf-lib 과 같은 방식).
//
// mermaid 는 gzip 약 950KB 다. 정적으로 import 하면 다이어그램을 쓰지 않는
// 45종 사용자에게도 전송된다. 그래서 이 파일 밖에서는 mermaid 를 절대 import 하지 않는다.
//
// NFR-02: mermaid 는 순수 클라이언트 렌더러다 — 네트워크로 나가지 않는다.
// CSP 도 그대로 통과한다(eval·new Function 을 쓰지 않는 것을 확인했다).
//
// 이 파일은 DOM 이 있어야 동작하므로 단위 테스트를 붙이지 않는다.
// 검증할 값이 있는 로직(파싱·변환)은 전부 diagram/ 아래 순수 함수로 빼 두었다.

let loading = null;

/** 화면 토큰과 맞춘 mermaid 설정. 다크 모드에서 글자가 안 보이면 안 된다. */
function themeConfig(dark) {
  return {
    startOnLoad: false,
    // 사용자가 넣은 텍스트를 렌더한다 — 스크립트·클릭 핸들러를 허용하지 않는다
    securityLevel: "strict",
    theme: dark ? "dark" : "default",
    fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif',
    themeVariables: dark
      ? { background: "#1b1930", primaryColor: "#262041", primaryTextColor: "#eceaf5", lineColor: "#8b86a8" }
      : { background: "#ffffff", primaryColor: "#eeecff", primaryTextColor: "#241f47", lineColor: "#6f6a8f" },
    er: { useMaxWidth: false },
    flowchart: { useMaxWidth: false, htmlLabels: false },
    sequence: { useMaxWidth: false },
    class: { useMaxWidth: false },
  };
}

/** mermaid 모듈을 한 번만 받아 온다. 두 번째 호출부터는 같은 약속을 돌려준다. */
function loadMermaid() {
  if (!loading) loading = import("mermaid").then((m) => m.default ?? m);
  return loading;
}

/**
 * mermaid 텍스트를 SVG 문자열로 만든다.
 *
 * @param {string} text  mermaid 문법
 * @param {{dark?:boolean, id?:string}} [opts]
 * @returns {Promise<{ok:true, svg:string} | {ok:false, message:string, line:number|null}>}
 */
export async function renderMermaid(text, { dark = false, id } = {}) {
  const src = String(text ?? "").trim();
  if (!src) return { ok: false, message: "내용이 비어 있습니다.", line: null };

  let mermaid;
  try {
    mermaid = await loadMermaid();
  } catch {
    return { ok: false, message: "다이어그램 엔진을 불러오지 못했습니다. 새로고침 후 다시 시도해 보세요.", line: null };
  }

  try {
    mermaid.initialize(themeConfig(dark));
    // id 는 DOM 에 임시로 붙는 요소 이름이 된다 — 매번 달라야 이전 결과와 안 섞인다
    const { svg } = await mermaid.render(id || `dg-${Math.random().toString(36).slice(2)}`, src);
    return { ok: true, svg };
  } catch (e) {
    return { ok: false, ...explain(e, src) };
  } finally {
    // 렌더 실패 시 mermaid 가 남기는 임시 요소를 치운다 — 놔두면 화면 아래에 쌓인다
    document.querySelectorAll('[id^="dg-"], #dmermaid, .mermaid-tmp').forEach((el) => {
      if (!el.dataset.keep) el.remove();
    });
  }
}

/**
 * mermaid 의 오류 메시지는 영어에 파서 용어가 섞여 있어 그대로 보여 주면 도움이 안 된다.
 * 몇 줄째인지와, 자주 나오는 원인을 한국어로 바꿔 준다.
 */
function explain(e, src) {
  const raw = String(e?.message || e || "");
  const lineMatch = raw.match(/line[: ]+(\d+)/i);
  const line = lineMatch ? Number(lineMatch[1]) : null;

  const firstWord = src.trim().split(/\s+/)[0] || "";
  if (/no diagram type detected|UnknownDiagramError/i.test(raw)) {
    return {
      message: `첫 줄에 다이어그램 종류가 있어야 합니다. 지금은 "${firstWord}" 로 시작합니다 — ` +
        "erDiagram · classDiagram · sequenceDiagram · flowchart TD · stateDiagram-v2 중 하나로 시작하세요.",
      line: 1,
    };
  }
  if (/Parse error|Expecting/i.test(raw)) {
    return {
      message: line
        ? `${line}번째 줄의 문법을 읽지 못했습니다. 화살표 기호와 괄호 짝을 확인해 보세요.`
        : "문법을 읽지 못했습니다. 화살표 기호와 괄호 짝을 확인해 보세요.",
      line,
    };
  }
  return { message: raw || "다이어그램을 그리지 못했습니다.", line };
}
