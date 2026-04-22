import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function Layout() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    navigate("/");
  };

  const isCommunityActive = location.pathname.startsWith("/community");
  const isRoomActive = location.pathname.startsWith("/rooms");

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="header-container">
          <NavLink className="header-logo" to="/">
            <span className="material-icons">code</span>
            <span>Boilerplate</span>
          </NavLink>

          <nav className={classNames("header-nav", mobileOpen && "mobile-open")} id="headerNav">
            <NavLink
              className={classNames("nav-item", isCommunityActive && "active")}
              to="/community"
              onClick={() => setMobileOpen(false)}
            >
              <span className="material-icons">forum</span>
              <span>커뮤니티</span>
            </NavLink>
            <NavLink
              className={classNames("nav-item", isRoomActive && "active")}
              to="/rooms"
              onClick={() => setMobileOpen(false)}
            >
              <span className="material-icons">chat</span>
              <span>채팅</span>
            </NavLink>
          </nav>

          <div className="user-menu">
            {status === "loading" && (
              <div id="authLoading" style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                <span>...</span>
              </div>
            )}

            {status !== "loading" && user && (
              <>
                <NavLink className="nav-item" to="/mypage" onClick={() => setMobileOpen(false)}>
                  <span className="material-icons">person</span>
                  <span>마이페이지</span>
                </NavLink>
                <div className="user-info">
                  <span className="material-icons">account_circle</span>
                  <span>{user.nickname}</span>
                </div>
                <button type="button" className="logout-btn" onClick={handleLogout}>
                  로그아웃
                </button>
              </>
            )}

            {status !== "loading" && !user && (
              <NavLink className="login-btn" to="/login" onClick={() => setMobileOpen(false)}>
                <span className="material-icons">login</span>
                <span>로그인</span>
              </NavLink>
            )}
          </div>

          <button className="mobile-menu-btn" type="button" onClick={() => setMobileOpen((prev) => !prev)}>
            <span className="material-icons">{mobileOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="app-footer">
        <div className="footer-container">
          <p>© 2025 Dollcatcher. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
