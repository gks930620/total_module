import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingHint from './LoadingHint.jsx'

// 인증 필요한 라우트 보호. 미인증 시 /login 으로.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  // 콜드스타트(서버 깨우는 중) 대비: 로딩이 길어지면 LoadingHint 가 안내를 덧붙인다.
  if (loading) return <LoadingHint />
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  return children
}
