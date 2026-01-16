import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../', // .env file is in the root directory , places에서 .env를 못찾아서 추가한 코드
  server: {
    host: true, // Allow access from 127.0.0.1 and other IPs
    proxy: {
      // Django transport API 프록시 (8000)
      // /api/v1/transport는 Django로 라우팅
      '/api/v1/transport': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // Django reservations API 프록시 (8000)
      '/api/v1/reservations': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // Django payments API 프록시 (8000)
      '/api/v1/payments': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // FastAPI 숙소/장소 API 프록시 (fastapi_places - 8002)
      // 주의: /api/v1 이 /api 보다 먼저 와야 함 (더 구체적인 경로 우선)
      '/api/v1': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // '/places': {
      //   target: 'http://localhost:8002',
      //   changeOrigin: true,
      //   secure: false,
      //   rewrite: (path) => path.replace(/^\/places/, ''), // '/places' 제거 (Nginx와 동일한 동작)
      // },
      '/search': {
        target: 'http://localhost:8001', // 로컬 FastAPI 포트
        changeOrigin: true,
        secure: false,
      },
    },
  },
})