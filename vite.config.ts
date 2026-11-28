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
      // /users、/score 同时是 SPA 路由前缀（/users、/scores）：
      // 浏览器文档导航（Accept: text/html）不代理，放行给 dev server 的 SPA fallback，
      // 否则刷新页面会被转发到后端，被全局鉴权拦成 401。
      // axios 请求 Accept 为 application/json, text/plain, */*，不受影响照常代理。
      '/users': {
        target: 'http://localhost:8080',
        bypass: (req) => (req.headers.accept?.includes('text/html') ? '/index.html' : undefined),
      },
      '/score': {
        target: 'http://localhost:8080',
        bypass: (req) => (req.headers.accept?.includes('text/html') ? '/index.html' : undefined),
      },
      '/analyze': 'http://localhost:8080',
      '/output': 'http://localhost:8080',
      '/migrate': 'http://localhost:8080',
    },
  },
})
