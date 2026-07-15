import { useEffect, useState } from 'react'

// 로딩이 delayMs 이상 지속되면 "서버 깨우는 중" 안내를 덧붙인다.
//  - App Sleeping(서버리스)으로 잠든 서버가 깨어나는 콜드스타트는 10~30초 걸릴 수 있다.
//    이때 아무 피드백이 없으면 멈춘 것처럼 보이므로, 지연 시 안내를 노출한다.
//  - 다른 전체 화면 로딩 자리에도 재사용 가능.
export default function LoadingHint({ delayMs = 4000, message = '불러오는 중...' }) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  return (
    <div className="state-msg">
      <div>{message}</div>
      {slow && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#888', lineHeight: 1.5 }}>
          서버가 잠들어 있어 깨우는 중이에요.
          <br />
          최대 30초 정도 걸릴 수 있어요 🙏
        </div>
      )}
    </div>
  )
}
