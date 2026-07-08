import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'

// 기본 레이아웃: 헤더 + 본문(main-content)
export default function Layout() {
  return (
    <>
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
    </>
  )
}
