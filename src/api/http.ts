import axios, { AxiosError } from 'axios'
import type { ApiResponse } from './types'

// axios 实例：开发环境经 vite 代理转发到后端 http://localhost:8080
const http = axios.create({
  baseURL: '/',
  timeout: 30000,
})

// 请求拦截：自动携带 JWT Token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：统一解包 {code, msg, data}
// - 成功（code=0）直接返回 data
// - 失败抛出带 msg 的 Error，由页面 catch 后提示
// - 非统一结构（如 uploadExcel / testOCR 接口）原样透传
http.interceptors.response.use(
  (resp) => {
    const body = resp.data as ApiResponse
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        return body.data
      }
      return Promise.reject(new Error(body.msg || '请求失败'))
    }
    return resp.data
  },
  (error: AxiosError<ApiResponse>) => {
    const raw = error.response?.data
    // blob 响应（如错题卷导出）的错误体是 JSON 文本，解析出 msg 再抛出
    if (raw instanceof Blob) {
      return raw.text().then((text) => {
        try {
          const body = JSON.parse(text) as { msg?: string }
          return Promise.reject(new Error(body.msg || '请求失败'))
        } catch {
          return Promise.reject(new Error('请求失败'))
        }
      })
    }
    const msg = raw?.msg || error.message || '网络错误'
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('expiresAt')
      window.location.href = '/login'
    }
    return Promise.reject(new Error(msg))
  },
)

// 类型包装：拦截器已解包 data，这里修正 axios 泛型签名，调用方直接拿到业务数据
export const request = {
  get: <T = unknown>(url: string, config?: object) =>
    http.get(url, config) as unknown as Promise<T>,
  post: <T = unknown>(url: string, data?: unknown, config?: object) =>
    http.post(url, data, config) as unknown as Promise<T>,
}

export default request
