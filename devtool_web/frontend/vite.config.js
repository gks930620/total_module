import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 서버: /api 만 Spring(8080)으로 프록시. 그 외 도구는 클라이언트 사이드라 백엔드 불필요.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
