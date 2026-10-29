import {
  BarChartOutlined,
  CloudDownloadOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  ReadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Layout, Menu, Typography } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '../api/types'

const { Sider, Header, Content } = Layout

const menuItems = [
  { key: '/scores', icon: <BarChartOutlined />, label: '成绩查询' },
  { key: '/questions', icon: <ReadOutlined />, label: '题目查询' },
  { key: '/err-questions', icon: <FileSearchOutlined />, label: '错题管理' },
  { key: '/crawler', icon: <CloudDownloadOutlined />, label: '爬虫抓题' },
  { key: '/users', icon: <TeamOutlined />, label: '用户列表' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const raw = localStorage.getItem('user')
  const user: User | null = raw ? (JSON.parse(raw) as User) : null

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <Layout style={{ height: '100%' }}>
      <Sider>
        <div style={{ color: '#fff', textAlign: 'center', padding: 16, fontSize: 16 }}>
          zm 教育考试系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 24px',
          }}
        >
          <Typography.Text strong>{user?.username ?? ''}</Typography.Text>
          <Typography.Text type="secondary" style={{ margin: '0 16px' }}>
            {user?.campus ?? ''}
          </Typography.Text>
          <a onClick={logout}>
            <LogoutOutlined /> 退出登录
          </a>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
