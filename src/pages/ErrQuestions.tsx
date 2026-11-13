import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, message, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import type { Key } from 'react'
import { exportErrSheet, exportScoreReport, getClassErrQuestions } from '../api'
import type { StudentErrQues } from '../api/types'
import QuestionBody from '../components/QuestionBody'

interface ClassCondition {
  text_name: string
  teacher: string
}

const columns: ColumnsType<StudentErrQues> = [
  { title: '学生姓名', dataIndex: 'student_name', width: 150 },
  { title: '教师', dataIndex: 'teacher', width: 120 },
  {
    title: '错题数',
    width: 100,
    render: (_, record) => (record.question_list.que_list ?? []).length / 2,
  },
  {
    title: '错题',
    render: (_, record) => (
      <>
        {(record.question_list.que_list ?? []).map((q) => (
          <Tag key={q.queNo} color="red">
            {q.queNo}
          </Tag>
        ))}
      </>
    ),
  },
]

export default function ErrQuestions() {
  const [form] = Form.useForm<ClassCondition>()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<StudentErrQues[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  // 导出中标记：null=空闲，'all'=完整错题卷，'fansan'=仅举一反三，'score'=成绩报告
  const [exporting, setExporting] = useState<'all' | 'fansan' | 'score' | null>(null)

  const search = async (values: ClassCondition) => {
    setLoading(true)
    try {
      const list = await getClassErrQuestions(values.text_name.trim(), values.teacher.trim())
      setData(list ?? [])
      setSelectedRowKeys([])
    } catch (e) {
      const msg = e instanceof Error ? e.message : '查询失败'
      // 后端无匹配数据时返回 msg=query error，此时提示“无数据”并清空表格
      if (msg === 'query error') {
        setData([])
        setSelectedRowKeys([])
        message.info('无数据')
      } else if (msg === 'paper not found') {
        // 试卷不存在（utils.ErrPaperNotFound）
        setData([])
        setSelectedRowKeys([])
        message.info('无试卷数据')
      } else {
        message.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // 把 blob 触发为浏览器下载
  const downloadZip = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // 当前勾选的学生行
  const selectedStudents = () =>
    data.filter((d) => selectedRowKeys.includes(`${d.teacher}-${d.student_name}`))

  // 导出勾选学生的错题卷（zip 内每个学生两份 HTML：学生版 / 带答案版）
  // onlyFanSan=true 时只导出举一反三错题
  const handleExport = async (onlyFanSan: boolean) => {
    const students = selectedStudents()
    if (students.length === 0) return
    setExporting(onlyFanSan ? 'fansan' : 'all')
    try {
      const values = form.getFieldsValue()
      const textName = values.text_name ?? ''
      const blob = await exportErrSheet({
        textName,
        teacher: values.teacher ?? '',
        students: students.map((s) => s.student_name),
        onlyFanSan,
      })
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
      const label = onlyFanSan ? '-举一反三' : ''
      downloadZip(blob, `错题报告${label}-${textName}-${dateStr}.zip`)
      message.success('导出成功')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(null)
    }
  }

  // 导出勾选学生的成绩分析报告（每人一份 A4 PDF，打包 zip）
  const handleExportScore = async () => {
    const students = selectedStudents()
    if (students.length === 0) return
    setExporting('score')
    try {
      const values = form.getFieldsValue()
      const textName = values.text_name ?? ''
      const teacher = values.teacher ?? ''
      const blob = await exportScoreReport({
        textName,
        teacher,
        students: students.map((s) => s.student_name),
      })
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
      downloadZip(blob, `成绩分析报告-${textName}-${dateStr}.zip`)
      message.success('成绩报告导出成功')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={search}>
          <Form.Item name="text_name" label="考试名称" rules={[{ required: true, message: '请输入考试名称' }]}>
            <Input placeholder="如：2025五秋综合刷题C16" allowClear />
          </Form.Item>
          <Form.Item name="teacher" label="教师" rules={[{ required: true, message: '请输入教师' }]}>
            <Input placeholder="教师姓名" allowClear />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
              查询
            </Button>
          </Form.Item>
        </Form>
      </Card>
      {selectedRowKeys.length > 0 && (
        <Space style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary">已勾选 {selectedRowKeys.length} 名学生</Typography.Text>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting === 'all'}
            disabled={exporting !== null}
            onClick={() => handleExport(false)}
          >
            导出错题报告
          </Button>
          <Button
            icon={<DownloadOutlined />}
            loading={exporting === 'fansan'}
            disabled={exporting !== null}
            onClick={() => handleExport(true)}
          >
            导出举一反三错题
          </Button>
          <Button
            icon={<DownloadOutlined />}
            loading={exporting === 'score'}
            disabled={exporting !== null}
            onClick={handleExportScore}
          >
            导出成绩报告
          </Button>
        </Space>
      )}
      <Table<StudentErrQues>
        rowKey={(record) => `${record.teacher}-${record.student_name}`}
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          columnWidth: 40,
        }}
        expandable={{
          expandedRowRender: (record) => (
            <div>
              {(record.question_list.que_list ?? []).map((q) => (
                <Card
                  key={q.queNo}
                  size="small"
                  style={{ marginBottom: 8 }}
                  title={<Tag color="blue">{q.queNo}</Tag>}
                >
                  <QuestionBody question={q} />
                </Card>
              ))}
            </div>
          ),
        }}
      />
    </div>
  )
}
