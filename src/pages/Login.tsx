import { LockOutlined, MobileOutlined } from '@ant-design/icons'
import { Button, Card, Checkbox, Form, Input, message, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'

interface LoginForm {
  phone: string
  password: string
  remember: boolean
}

/** 登录态有效期：6 小时 */
const LOGIN_EXPIRES_MS = 6 * 60 * 60 * 1000

/** 勾选"记住用户"时登录态有效期：7 天 */
const REMEMBER_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000

/** 记住用户时保存手机号的 key */
const REMEMBER_PHONE_KEY = 'rememberPhone'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  // 之前勾选过"记住用户"则回填手机号
  const rememberedPhone = localStorage.getItem(REMEMBER_PHONE_KEY) ?? undefined

  const onFinish = async (values: LoginForm) => {
    setLoading(true)
    try {
      const result = await login(values.phone, values.password)
      localStorage.setItem('token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
      // 记录过期时间：记住用户 7 天，否则 6 小时后登录态失效
      const expiresIn = values.remember ? REMEMBER_EXPIRES_MS : LOGIN_EXPIRES_MS
      localStorage.setItem('expiresAt', String(Date.now() + expiresIn))
      // 记住用户：登录成功后保存手机号；未勾选则清除
      if (values.remember) {
        localStorage.setItem(REMEMBER_PHONE_KEY, values.phone)
      } else {
        localStorage.removeItem(REMEMBER_PHONE_KEY)
      }
      message.success('登录成功')
      navigate('/scores')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        background: '#f5f5f5',
      }}
    >
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          卓鸣考试管理
        </Typography.Title>
        <Form<LoginForm>
          onFinish={onFinish}
          size="large"
          initialValues={{ phone: rememberedPhone, remember: Boolean(rememberedPhone) }}
        >
          <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input prefix={<MobileOutlined />} placeholder="手机号" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item name="remember" valuePropName="checked">
            <Checkbox>记住用户</Checkbox>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
