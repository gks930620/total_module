import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function OAuth2RedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <section className="oauth-loading">
      <div className="loading-container">
        <div className="spinner" />
        <h2>로그인 처리 중...</h2>
        <p className="muted-text">잠시만 기다려주세요.</p>
      </div>
    </section>
  );
}
