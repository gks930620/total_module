import { useAuth } from '../context/AuthContext.jsx'

// mypage.html: GET /api/my/info → { data: { username, nickname, email, provider } }
// AuthContext.refresh() 가 동일 엔드포인트로 user 를 채우므로 그대로 사용한다.
// (라우트는 ProtectedRoute 로 보호되어 미인증 시 이미 /login 으로 리다이렉트됨)
export default function MyPage() {
  const { user, loading } = useAuth()

  if (loading) return <div className="state-msg">불러오는 중...</div>

  const rows = [
    ['아이디 (Username)', user?.username],
    ['닉네임', user?.nickname],
    ['이메일', user?.email],
    ['로그인 제공자', user?.provider],
  ]

  return (
    <div className="card" style={{ maxWidth: 800, margin: '40px auto' }}>
      <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 500, color: '#333' }}>마이페이지</h1>
      </div>

      <div
        style={{
          display: 'grid', gridTemplateColumns: '150px 1fr',
          gap: 16, fontSize: 16,
        }}
      >
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt style={{ fontWeight: 500, color: '#555' }}>{label}</dt>
            <dd style={{ color: '#333', wordBreak: 'break-all' }}>{value || '정보 없음'}</dd>
          </div>
        ))}
      </div>
    </div>
  )
}
