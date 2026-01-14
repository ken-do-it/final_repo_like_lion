import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../', // .env file is in the root directory , places에서 .env를 못찾아서 추가한 코드
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // FastAPI 숙소/장소 API 프록시 (fastapi_places - 8002)
      '/api/v1': {
        target: 'http://localhost:8002',
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