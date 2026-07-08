import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { join } from '../api/auth.js'

export default function SignupPage() {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSignup = async (event) => {
    event.preventDefault()
    setError('')

    // 비밀번호 확인 (signup.html 과 동일한 클라이언트 검증)
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setSubmitting(true)
    try {
      await join({ username, password, email, nickname })
      alert('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.')
      navigate('/login?username=' + encodeURIComponent(username))
    } catch (err) {
      // 유효성 검증 에러(errors[])가 있으면 상세 메시지 표시
      if (err.errors && err.errors.length > 0) {
        setError(err.errors.map((e) => e.message).join('\n'))
      } else {
        setError(err.message || '회원가입에 실패했습니다. 입력 정보를 확인해주세요.')
      }
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
          <span className="material-icons" style={{ fontSize: 36 }}>person_add</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 500, color: '#333' }}>회원가입</h1>
      </div>

      <form onSubmit={handleSignup}>
        <div className="form-group">
          <label htmlFor="signupUsername">아이디</label>
          <input
            type="text"
            id="signupUsername"
            placeholder="아이디를 입력하세요"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="signupPassword">비밀번호</label>
          <input
            type="password"
            id="signupPassword"
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <div className="form-group">
          <label htmlFor="signupPasswordConfirm">비밀번호 확인</label>
          <input
            type="password"
            id="signupPasswordConfirm"
            placeholder="비밀번호를 다시 입력하세요"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <div className="form-group">
          <label htmlFor="signupEmail">이메일</label>
          <input
            type="email"
            id="signupEmail"
            placeholder="이메일을 입력하세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="signupNickname">닉네임</label>
          <input
            type="text"
            id="signupNickname"
            placeholder="닉네임을 입력하세요"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="error-text" style={{ marginBottom: 8, whiteSpace: 'pre-line' }}>{error}</div>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
          {submitting ? '처리 중...' : '회원가입'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <span>이미 계정이 있으신가요? </span>
        <Link to="/login" style={{ color: '#6200ea', textDecoration: 'none', fontWeight: 500 }}>로그인</Link>
      </div>
    </div>
  )
}
