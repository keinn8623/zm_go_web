import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 开发环境代理：将后端接口转发到 Go 服务（http://localhost:8080），避免跨域
    proxy: {
      '/auth': 'http://localhost:8080',
      '/users': 'http://localhost:8080',
      '/score': 'http://localhost:8080',
      '/output': 'http://localhost:8080',
      '/migrate': 'http://localhost:8080',
    },
  },
})
