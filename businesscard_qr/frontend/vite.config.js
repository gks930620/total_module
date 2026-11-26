import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 운영에서는 Spring 이 이 빌드 결과(dist → src/main/resources/static)를 같은 오리진에서 서빙한다.
// 그래서 API 는 항상 상대 경로이고 CORS 가 없다.
//
// 개발 서버(5173)만 API·업로드·로그인을 Spring(기본 8081)으로 넘긴다. 같은 오리진처럼 보여야
// SameSite=Strict 세션 쿠키가 실린다. 8081 이 이미 쓰이고 있으면 BQ_BACKEND 로 바꾼다:
//   BQ_BACKEND=http://localhost:18081 npm run dev
const backend = process.env.BQ_BACKEND || "http://localhost:8081";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backend,
      "/uploads": backend,
      "/manifest.webmanifest": backend,
    },
  },
  build: {
    outDir: "dist",
    // 소스맵을 운영에 내보내지 않는다 — 원본 코드 구조를 그대로 공개할 이유가 없다.
    sourcemap: false,
  },
  test: {
    environment: "node",
  },
});
