// 도구 하나가 죽어도 사이트 전체가 흰 화면이 되지 않게 한다.
//
// React 는 렌더 중 예외가 나면 **트리 전체를 언마운트한다.** 경계가 없으면 도구 하나의
// 버그가 사이트 전체를 날린다 — 사용자에게는 "사이트가 고장났다" 로 보이고, 무엇을 하다
// 그랬는지도 알 수 없다.
//
// 여기서만 클래스 컴포넌트를 쓴다. 렌더 오류를 잡는 훅이 아직 없다.
import { Component } from "react";
import { Link } from "react-router-dom";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 서버로 보내지 않는다(NFR-02). 개발자도구에만 남긴다 —
    // 사용자가 화면을 캡처해 보낼 때 우리가 볼 수 있는 곳이기도 하다.
    console.error("[도구 오류]", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="tool-page">
        <div className="notice error">
          <b>이 도구를 그리는 중 문제가 생겼습니다.</b>
          <div style={{ marginTop: 6 }}>
            입력한 값은 어디로도 전송되지 않았습니다. 다른 도구는 정상입니다.
          </div>
        </div>

        <div className="toolbar">
          {/* 새로고침이 대개 통한다 — 가장 먼저 권한다 */}
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            새로고침
          </button>
          <Link className="btn" to="/">도구 목록으로</Link>
        </div>

        {/* 무엇이 잘못됐는지 숨기지 않는다. 개발자가 쓰는 사이트다. */}
        <details className="error-detail">
          <summary>오류 내용 보기</summary>
          <pre className="mono-out">{String(error?.stack || error?.message || error)}</pre>
        </details>
      </div>
    );
  }
}
