import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// oauth2-redirect.html: 소셜 로그인 성공 시 서버가 이미 쿠키를 설정한 상태로
// 이 페이지에 도달한다. 인증 상태를 갱신한 뒤 홈으로 이동한다.
export default function OAuth2RedirectPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refresh()
      if (!cancelled) navigate('/', { replace: true })
    })()
    return () => { cancelled = true }
  }, [refresh, navigate])

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'white', textAlign: 'center',
      }}
    >
      <div>
        <div
          style={{
            border: '4px solid rgba(255,255,255,0.3)', borderTop: '4px solid white',
            borderRadius: '50%', width: 50, height: 50, margin: '0 auto 20px',
            animation: 'spin 1s linear infinite',
          }}
        />
        <h2 style={{ fontSize: 24, margin: 0 }}>로그인 처리 중...</h2>
        <p style={{ fontSize: 14, opacity: 0.8 }}>잠시만 기다려주세요.</p>
      </div>
      <style>{'@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }'}</style>
    </div>
  )
}
