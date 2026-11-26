import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./lib/I18nProvider.jsx";
import { AuthProvider, RequireAuth } from "./context/AuthContext.jsx";
import { CardsProvider } from "./context/CardsContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import CardListPage from "./pages/CardListPage.jsx";
import CardFormPage from "./pages/CardFormPage.jsx";
import CardDetailPage from "./pages/CardDetailPage.jsx";
import PublicCardPage from "./pages/PublicCardPage.jsx";
import ProPage from "./pages/ProPage.jsx";
import PaymentSuccessPage from "./pages/PaymentSuccessPage.jsx";
import PaymentFailPage from "./pages/PaymentFailPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

/**
 * 라우트 목록. ⚠️ 서버의 SpaController 와 반드시 같이 고친다 —
 * 서버가 모르는 경로는 새로고침하면 404 가 난다(정합성은 SpaServingIntegrationTest 가 지킨다).
 */
export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <CardsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              {/* 받는 사람이 여는 화면 — 로그인과 무관하다 */}
              <Route path="/c/:cardId" element={<PublicCardPage />} />

              <Route path="/cards" element={<RequireAuth><CardListPage /></RequireAuth>} />
              <Route path="/cards/new" element={<RequireAuth><CardFormPage /></RequireAuth>} />
              <Route path="/cards/:cardId" element={<RequireAuth><CardDetailPage /></RequireAuth>} />
              <Route path="/cards/:cardId/edit" element={<RequireAuth><CardFormPage /></RequireAuth>} />
              <Route path="/pro" element={<RequireAuth><ProPage /></RequireAuth>} />
              {/* 토스 결제창이 결제 후 돌려보내는 곳(successUrl·failUrl) — 설계 웹결제_설계.md */}
              <Route path="/pro/success" element={<RequireAuth><PaymentSuccessPage /></RequireAuth>} />
              <Route path="/pro/fail" element={<RequireAuth><PaymentFailPage /></RequireAuth>} />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
          </CardsProvider>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
