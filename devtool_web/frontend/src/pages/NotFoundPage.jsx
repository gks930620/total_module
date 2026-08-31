// 404 — 도구 그리드 축약판으로 안내 (화면설계 §5)
import { Link } from "react-router-dom";
import { ACTIVE_TOOLS } from "../lib/tools.js";
import { useMeta } from "../lib/useMeta.js";

export function NotFoundPage() {
  useMeta({ title: "페이지를 찾을 수 없습니다 | 개발자 유틸 모음", description: "요청한 페이지가 없습니다. 사용 가능한 도구로 이동하세요." });
  return (
    <div className="notfound">
      <h1>404</h1>
      <p>요청하신 페이지를 찾을 수 없습니다.</p>
      <div className="notfound-tools">
        {ACTIVE_TOOLS.map((t) => (
          <Link key={t.slug} to={t.path} className="btn">
            <span className="material-icons">{t.icon}</span> {t.name}
          </Link>
        ))}
      </div>
      <Link to="/" className="btn primary">홈으로</Link>
    </div>
  );
}
