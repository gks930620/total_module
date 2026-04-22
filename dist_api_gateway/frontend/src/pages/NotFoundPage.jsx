import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="empty-state">
      <span className="material-icons">search_off</span>
      <h3>페이지를 찾을 수 없습니다</h3>
      <p>요청한 경로가 존재하지 않습니다.</p>
      <div style={{ marginTop: 16 }}>
        <Link className="btn btn-primary" to="/">
          홈으로
        </Link>
      </div>
    </section>
  );
}
