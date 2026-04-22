import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { SignupPage } from "./pages/SignupPage.jsx";
import { MyPage } from "./pages/MyPage.jsx";
import { CommunityListPage } from "./pages/CommunityListPage.jsx";
import { CommunityDetailPage } from "./pages/CommunityDetailPage.jsx";
import { CommunityWritePage } from "./pages/CommunityWritePage.jsx";
import { CommunityEditPage } from "./pages/CommunityEditPage.jsx";
import { RoomListPage } from "./pages/RoomListPage.jsx";
import { RoomPage } from "./pages/RoomPage.jsx";
import { OAuth2RedirectPage } from "./pages/OAuth2RedirectPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/mypage"
          element={
            <ProtectedRoute>
              <MyPage />
            </ProtectedRoute>
          }
        />
        <Route path="/community" element={<CommunityListPage />} />
        <Route path="/community/detail" element={<CommunityDetailPage />} />
        <Route
          path="/community/write"
          element={
            <ProtectedRoute>
              <CommunityWritePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community/edit"
          element={
            <ProtectedRoute>
              <CommunityEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rooms"
          element={
            <ProtectedRoute>
              <RoomListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rooms/:roomId"
          element={
            <ProtectedRoute>
              <RoomPage />
            </ProtectedRoute>
          }
        />
        <Route path="/custom-oauth2/login/success" element={<OAuth2RedirectPage />} />
        <Route path="/community/list" element={<Navigate to="/community" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
