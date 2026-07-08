import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Header() {
  const { isAuthenticated, user, loading, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className="app-header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          <span className="material-icons">toys</span>
          <span>인형뽑기방</span>
        </Link>

        <nav className="header-nav">
          <NavLink to="/map" className="nav-item">
            <span className="material-icons">map</span><span>지도</span>
          </NavLink>
          <NavLink to="/doll-shop/list" className="nav-item">
            <span className="material-icons">store</span><span>매장</span>
          </NavLink>
          <NavLink to="/community" className="nav-item">
            <span className="material-icons">forum</span><span>커뮤니티</span>
          </NavLink>
        </nav>

        <div className="user-menu">
          {loading ? (
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>...</span>
          ) : isAuthenticated ? (
            <>
              <NavLink to="/mypage" className="nav-item">
                <span className="material-icons">person</span><span>마이페이지</span>
              </NavLink>
              <div className="user-info">
                <span className="material-icons">account_circle</span>
                <span>{user?.nickname}</span>
              </div>
              <button type="button" className="logout-btn" onClick={handleLogout}>로그아웃</button>
            </>
          ) : (
            <Link to="/login" className="login-btn">
              <span className="material-icons">login</span><span>로그인</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
