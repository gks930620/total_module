import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import MapPage from './pages/MapPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import MyPage from './pages/MyPage.jsx'
import OAuth2RedirectPage from './pages/OAuth2RedirectPage.jsx'

import CommunityListPage from './pages/community/CommunityListPage.jsx'
import CommunityDetailPage from './pages/community/CommunityDetailPage.jsx'
import CommunityWritePage from './pages/community/CommunityWritePage.jsx'
import CommunityEditPage from './pages/community/CommunityEditPage.jsx'

import DollShopListPage from './pages/dollshop/DollShopListPage.jsx'
import DollShopDetailPage from './pages/dollshop/DollShopDetailPage.jsx'

import ReviewWritePage from './pages/review/ReviewWritePage.jsx'
import ReviewEditPage from './pages/review/ReviewEditPage.jsx'

export default function App() {
  return (
    <Routes>
      {/* OAuth2 리다이렉트 (레이아웃 없음) */}
      <Route path="/custom-oauth2/login/success" element={<OAuth2RedirectPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<MapPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />

        {/* 커뮤니티 */}
        <Route path="/community" element={<CommunityListPage />} />
        <Route path="/community/list" element={<Navigate to="/community" replace />} />
        <Route path="/community/detail" element={<CommunityDetailPage />} />
        <Route path="/community/write" element={<ProtectedRoute><CommunityWritePage /></ProtectedRoute>} />
        <Route path="/community/edit" element={<ProtectedRoute><CommunityEditPage /></ProtectedRoute>} />

        {/* 매장 */}
        <Route path="/doll-shop/list" element={<DollShopListPage />} />
        <Route path="/doll-shop/detail" element={<DollShopDetailPage />} />

        {/* 리뷰 (매장 상세에서 진입) */}
        <Route path="/review/write" element={<ProtectedRoute><ReviewWritePage /></ProtectedRoute>} />
        <Route path="/review/edit" element={<ProtectedRoute><ReviewEditPage /></ProtectedRoute>} />

        <Route path="*" element={<div className="state-msg">페이지를 찾을 수 없습니다.</div>} />
      </Route>
    </Routes>
  )
}
