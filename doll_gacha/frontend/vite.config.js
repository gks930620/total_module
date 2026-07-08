import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 통합형 단일 서버: 빌드 산출물을 Spring static 으로 복사(build.gradle 에서 처리)
// 개발 분리 실행: npm run dev (5173) → /api 등은 8080 백엔드로 프록시
const backend = 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/custom-oauth2': { target: backend, changeOrigin: true },
      '/login/oauth2': { target: backend, changeOrigin: true },
      '/oauth2': { target: backend, changeOrigin: true },
      '/images': { target: backend, changeOrigin: true },
      '/uploads': { target: backend, changeOrigin: true },
    },
  },
})
