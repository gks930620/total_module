// 도구 화면 맨 아래 "이렇게 씁니다" — 하단 FAQ 를 대신한다.
//
// FAQ 는 "사람들이 이런 걸 궁금해할 것이다" 를 지어내는 형식이라, 실제로 묻지 않는 질문이
// 대부분이었다. 대신 **검증할 수 있는 것만** 적는다 —
//   ① 화면이 어떻게 생겼는지(그림)  ② 무엇을 넣으면 무엇이 나오는지(실제 값)  ③ 짧은 설명.
//
// 네 조각 다 선택이다. 그림이 필요 없는 도구는 screen 을 안 넘기면 된다.

/** 화면 뼈대 안의 칸 하나. 머리글은 위, 설명은 가운데, 주 버튼은 아래. */
function Pane({ head, body, action, dashed }) {
  return (
    <div className={`fig-pane${dashed ? " dashed" : ""}`}>
      {head && <b>{head}</b>}
      {body && <span>{body}</span>}
      {action && <em>{action}</em>}
    </div>
  );
}

/**
 * 도구 화면의 뼈대를 그린 와이어프레임.
 *
 * 스크린샷을 쓰지 않는 이유: 46종을 찍어 두면 화면을 고칠 때마다 46장이 같이 낡는다.
 * 뼈대만 그리면 "어느 칸에 넣고 어디서 받는지" 라는, 잘 안 바뀌는 사실만 남는다.
 *
 * **SVG 가 아니라 HTML 이다.** 오른쪽 예시가 길어지면 이 그림도 같이 늘어나야 두 칸의
 * 높이가 맞는데, viewBox 는 비율이 고정이라 세로로만 늘리면 글자와 원이 찌그러진다.
 * div 로 그리면 flex 가 알아서 늘려 주고 글자는 그대로다.
 *
 * layout — split: 좌우 두 칸 / stack: 위(입력)·아래(결과) / single: 한 칸
 * 색은 토큰으로만 칠한다(--fig-*). 두는 자리가 배경 위인지 흰 카드 위인지에 따라
 * 창과 칸의 명암이 뒤집혀야 해서 바깥에서 CSS 로 갈아 끼운다.
 */
function ScreenFigure({ layout = "split", left, right, caption, label = "화면 구성" }) {
  // 그림과 설명을 형제로 내보낸다 — 설명이 그림 안에 있으면 정렬 영역(guide-cols 1행)에
  // 같이 들어가서, 그림 아랫변이 오른쪽 마지막 상자보다 설명 높이만큼 위로 뜬다.
  return (
    <>
      <div className="guide-figure">
        <span className="guide-example-label">{label}</span>
        <div className={`fig-window fig-${layout}`}>
          <div className="fig-bar" aria-hidden="true"><i /><i /><i /></div>
          <div className="fig-body">
            <Pane {...left} />
            {layout !== "single" && right && (
              <>
                {/* 넣는 칸에서 받는 칸으로 */}
                <span className="fig-arrow" aria-hidden="true">{layout === "stack" ? "↓" : "→"}</span>
                <Pane {...right} />
              </>
            )}
          </div>
        </div>
      </div>
      {caption && <p className="guide-figcaption">{caption}</p>}
    </>
  );
}

export function ToolGuide({ intro, screen, example, notes = [] }) {
  return (
    <section className="tool-guide" aria-label="이 도구 사용법">
      <h2>이렇게 씁니다</h2>
      {intro && <p className="guide-intro">{intro}</p>}

      {(screen || example) && (
        <div className="guide-cols">
          {screen && <ScreenFigure {...screen} />}
          {example && (
            <div className="guide-example">
              <div>
                <span className="guide-example-label">{example.inLabel || "넣는 값"}</span>
                <pre className="mono">{example.in}</pre>
              </div>
              <div>
                <span className="guide-example-label">{example.outLabel || "나오는 값"}</span>
                <pre className="mono">{example.out}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <ul className="guide-notes">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </section>
  );
}
