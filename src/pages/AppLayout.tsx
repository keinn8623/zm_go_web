import {
  BarChartOutlined,
  CloudDownloadOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Layout, Menu, Typography } from 'antd'
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '../api/types'

const { Sider, Header, Content } = Layout

// 路由 → 需自动展开的一级菜单分组 key
const openByPath: Record<string, string[]> = {
  '/scores': ['grade'],
  '/questions': ['paper'],
  '/err-questions': ['grade', 'paper'], // 错题管理同时属于两个分组
  '/crawler': ['admin'],
  '/users': ['user'],
}

const menuItems = [
  {
    key: 'grade',
    icon: <BarChartOutlined />,
    label: '成绩管理',
    children: [
      { key: '/scores', label: '成绩查询' },
      { key: '/err-questions', label: '错题管理' },
    ],
  },
  {
    key: 'paper',
    icon: <FileSearchOutlined />,
    label: '试卷管理',
    children: [
      { key: '/questions', label: '题目查询' },
      // 与成绩管理下的入口共用同一页面，key 相同以便选中态同步
      { key: '/err-questions', label: '错题管理' },
    ],
  },
  {
    key: 'user',
    icon: <TeamOutlined />,
    label: '用户管理',
    children: [{ key: '/users', label: '用户列表' }],
  },
  {
    key: 'admin',
    icon: <CloudDownloadOutlined />,
    label: '管理员工具',
    children: [{ key: '/crawler', label: '爬虫抓题' }],
  },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  // 展开的分组：路由变化时自动展开对应分组，手动收起后保持收起。
  // 渲染期间同步 state（React 官方推荐模式），避免 effect 中 setState 的连锁渲染
  const [openKeys, setOpenKeys] = useState<string[]>(openByPath[location.pathname] ?? [])
  const [prevPath, setPrevPath] = useState(location.pathname)
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname)
    const targets = openByPath[location.pathname] ?? []
    setOpenKeys((prev) => Array.from(new Set([...prev, ...targets])))
  }

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
          卓鸣考试管理
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems}
          onClick={({ key }) => {
            // 分组 key（grade/paper/...）不参与路由跳转
            if (key.startsWith('/')) navigate(key)
          }}
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
