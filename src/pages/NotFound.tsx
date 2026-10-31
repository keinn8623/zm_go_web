import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

/** 404 页面：登录后访问不存在的路径时展示，引导返回首页 */
export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Result
        status="404"
        title="404"
        subTitle="抱歉，你访问的页面不存在或已被移除"
        extra={
          <Button type="primary" onClick={() => navigate('/', { replace: true })}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}
