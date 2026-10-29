import { CloudDownloadOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, message, Typography } from 'antd'
import { useState } from 'react'
import { testCrawler } from '../api'

interface CrawlCondition {
  clientToken: string
  cookieStr: string
  paperID: string
}

export default function Crawler() {
  const [form] = Form.useForm<CrawlCondition>()
  const [loading, setLoading] = useState(false)

  const handleCrawl = async (values: CrawlCondition) => {
    setLoading(true)
    try {
      await testCrawler(values.clientToken.trim(), values.cookieStr.trim(), values.paperID.trim())
      message.success('抓取成功，题目已入库')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '抓取失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Card style={{ maxWidth: 720 }}>
        <Typography.Title level={5}>爬虫抓题</Typography.Title>
        <Typography.Paragraph type="secondary">
          通过 clientToken 与 Cookie 调用外部题库接口，按试卷 ID 抓取「温故知新」「举一反三」题块并写入题库。
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={handleCrawl}>
          <Form.Item
            name="clientToken"
            label="clientToken"
            rules={[{ required: true, message: '请输入 clientToken' }]}
          >
            <Input.TextArea rows={2} placeholder="客户端 Token" allowClear />
          </Form.Item>
          <Form.Item
            name="cookieStr"
            label="Cookie"
            rules={[{ required: true, message: '请输入 Cookie' }]}
          >
            <Input.TextArea rows={4} placeholder="浏览器请求头中的完整 Cookie 字符串" allowClear />
          </Form.Item>
          <Form.Item
            name="paperID"
            label="试卷 ID"
            rules={[{ required: true, message: '请输入试卷 ID' }]}
          >
            <Input placeholder="外部题库中的试卷 ID" allowClear />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<CloudDownloadOutlined />} loading={loading}>
              开始抓取
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
