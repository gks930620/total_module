import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <>
      <section className="hero-section">
        <h1 className="hero-title">Spring Boot Boilerplate</h1>
        <p className="hero-subtitle">JWT 인증, OAuth2, 게시판, 파일 업로드가 포함된 스타터 템플릿</p>
        <Link className="cta-button" to="/community">
          커뮤니티 바로가기
        </Link>
        <a className="cta-button-outline" href="/swagger-ui.html" rel="noreferrer" target="_blank">
          API 문서
        </a>
      </section>

      <section className="feature-section">
        <h2 className="section-title">주요 기능</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <span className="material-icons">security</span>
            </div>
            <h3 className="feature-title">Security & JWT</h3>
            <p className="feature-desc">Spring Security 기반 인증/인가, JWT 토큰 방식의 stateless 인증 구현</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <span className="material-icons">login</span>
            </div>
            <h3 className="feature-title">OAuth2 소셜 로그인</h3>
            <p className="feature-desc">카카오, 구글 OAuth2 로그인 지원. 추가 Provider 확장 가능</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <span className="material-icons">forum</span>
            </div>
            <h3 className="feature-title">커뮤니티 게시판</h3>
            <p className="feature-desc">게시글 CRUD, 댓글 기능, 페이징, QueryDSL 동적 검색</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <span className="material-icons">cloud_upload</span>
            </div>
            <h3 className="feature-title">파일 업로드</h3>
            <p className="feature-desc">로컬/Supabase 전략 패턴 파일 저장, 이미지 리사이징 지원</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <span className="material-icons">api</span>
            </div>
            <h3 className="feature-title">Swagger API 문서</h3>
            <p className="feature-desc">OpenAPI 3.0 기반 자동 API 문서화, 테스트 UI 제공</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <span className="material-icons">rocket_launch</span>
            </div>
            <h3 className="feature-title">Docker & 배포</h3>
            <p className="feature-desc">Dockerfile 제공, Railway 등 클라우드 배포 가이드 포함</p>
          </div>
        </div>
      </section>
    </>
  );
}
