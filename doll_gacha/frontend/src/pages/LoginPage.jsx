import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { login } from '../api/auth.js'

// OAuth2 소셜 로그인은 서버 URL 로의 외부 리다이렉트 (login.html 과 동일)
const KAKAO_LOGIN_URL = '/custom-oauth2/login/web/kakao'
const GOOGLE_LOGIN_URL = '/custom-oauth2/login/web/google'

export default function LoginPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // login.html: ?username= 쿼리로 아이디 프리필 (회원가입 직후 등)
  useEffect(() => {
    const prefill = searchParams.get('username')
    if (prefill) setUsername(prefill)
  }, [searchParams])

  const from = location.state?.from || '/'

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      // 로그인 성공: 쿠키 설정됨 → 인증 상태 갱신 후 이동
      await refresh()
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 450, margin: '40px auto', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div
          style={{
            backgroundColor: '#6200ea', color: 'white', width: 64, height: 64,
            borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: 16,
          }}
        >
          <span className="material-icons" style={{ fontSize: 36 }}>toys</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 500, color: '#333', marginBottom: 8 }}>로그인</h1>
        <p style={{ fontSize: 14, color: '#666' }}>전국 인형뽑기방 정보</p>
      </div>

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="loginUsername">아이디</label>
          <input
            type="text"
            id="loginUsername"
            placeholder="아이디를 입력하세요"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="loginPassword">비밀번호</label>
          <input
            type="password"
            id="loginPassword"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="error-text" style={{ marginBottom: 8 }}>{error}</div>}

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
          {submitting ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div
        style={{
          display: 'flex', alignItems: 'center', margin: '24px 0',
          color: '#999', fontSize: 14, gap: 16,
        }}
      >
        <span style={{ flex: 1, height: 1, backgroundColor: '#ddd' }} />
        <span>또는</span>
        <span style={{ flex: 1, height: 1, backgroundColor: '#ddd' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="button"
          className="btn"
          style={{ width: '100%', backgroundColor: '#fee500', color: '#333' }}
          onClick={() => { window.location.href = KAKAO_LOGIN_URL }}
        >
          카카오로 시작하기
        </button>
        <button
          type="button"
          className="btn"
          style={{ width: '100%', backgroundColor: '#fff', color: '#333', border: '1px solid #ddd' }}
          onClick={() => { window.location.href = GOOGLE_LOGIN_URL }}
        >
          구글로 시작하기
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <span>계정이 없으신가요? </span>
        <Link to="/signup" style={{ color: '#6200ea', textDecoration: 'none', fontWeight: 500 }}>회원가입</Link>
      </div>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Link to="/" style={{ color: '#6200ea', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
