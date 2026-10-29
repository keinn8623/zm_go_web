import { Navigate, Outlet, Route, BrowserRouter, Routes } from 'react-router-dom'
import AppLayout from './pages/AppLayout'
import Crawler from './pages/Crawler'
import ErrQuestions from './pages/ErrQuestions'
import Login from './pages/Login'
import ScoreList from './pages/ScoreList'
import TextQuestions from './pages/TextQuestions'
import UserList from './pages/UserList'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/scores" replace />} />
            <Route path="scores" element={<ScoreList />} />
            <Route path="questions" element={<TextQuestions />} />
            <Route path="err-questions" element={<ErrQuestions />} />
            <Route path="crawler" element={<Crawler />} />
            <Route path="users" element={<UserList />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

/** 路由守卫：未登录（无 token）或登录态过期时跳转登录页 */
function RequireAuth() {
  const token = localStorage.getItem('token')
  // 登录态 6 小时过期：过期则清除缓存并回到登录页
  if (token && Number(localStorage.getItem('expiresAt')) <= Date.now()) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('expiresAt')
    return <Navigate to="/login" replace />
  }
  return token ? <Outlet /> : <Navigate to="/login" replace />
}
