import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/app.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 서비스워커 — 앱 셸만 캐시한다(명함 데이터는 캐시하지 않는다. 설계 §6).
// 개발 서버에선 등록하지 않는다: 낡은 번들이 캐시되면 고친 코드가 안 보여 헷갈린다.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록 실패해도 웹앱은 그대로 동작한다 — 오프라인·설치만 안 될 뿐이다.
    });
  });
}
