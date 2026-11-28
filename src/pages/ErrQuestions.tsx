import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, message, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import type { Key } from 'react'
import {
  downloadExport,
  getClassErrQuestions,
  getExportProgress,
  submitExportErrSheet,
  submitExportScoreReport,
} from '../api'
import type { PdfJobState, StudentErrQues } from '../api/types'
import QuestionBody from '../components/QuestionBody'

interface ClassCondition {
  text_name: string
  teacher: string
}

/** 错题数：温故知新与举一反三成对出现时按对数展示；只有举一反三（或只有温故知新）时按实际条数展示 */
const errCount = (record: StudentErrQues) => {
  const list = record.question_list.que_list ?? []
  const hasWenGu = list.some((q) => q.queNo.includes('温故知新'))
  const hasFanSan = list.some((q) => q.queNo.includes('举一反三'))
  return hasWenGu && hasFanSan ? list.length / 2 : list.length
}

const columns: ColumnsType<StudentErrQues> = [
  { title: '学生姓名', dataIndex: 'student_name', width: 150 },
  { title: '教师', dataIndex: 'teacher', width: 120 },
  {
    title: '错题数',
    width: 100,
    render: (_, record) => errCount(record),
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
  // 异步导出进度文案：null=空闲，非空时显示在按钮行尾部
  const [exportProgress, setExportProgress] = useState<string | null>(null)

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

  // 轮询异步导出进度：每 2s 一次，30 分钟兜底；done 返回终态，error 抛错
  const pollExport = async (taskId: string): Promise<PdfJobState> => {
    const deadline = Date.now() + 30 * 60 * 1000
    for (;;) {
      const st = await getExportProgress(taskId)
      if (st.status === 'done') return st
      if (st.status === 'error') throw new Error(st.error || '导出失败')
      if (Date.now() > deadline) throw new Error('导出超时（30 分钟），请稍后重试或联系管理员')
      setExportProgress(
        st.status === 'running' && st.total > 0
          ? `导出中：已完成 ${st.done}/${st.total}`
          : '任务已提交，排队中...',
      )
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  // 当前勾选的学生行
  const selectedStudents = () =>
    data.filter((d) => selectedRowKeys.includes(`${d.teacher}-${d.student_name}`))

  // 导出勾选学生的错题卷：异步提交 → 轮询进度 → 下载 zip（后端单消费者串行渲染防 OOM）
  // onlyFanSan=true 时只导出举一反三错题
  const handleExport = async (onlyFanSan: boolean) => {
    const students = selectedStudents()
    if (students.length === 0) return
    setExporting(onlyFanSan ? 'fansan' : 'all')
    setExportProgress('任务已提交，排队中...')
    try {
      const values = form.getFieldsValue()
      const textName = values.text_name ?? ''
      const { taskId } = await submitExportErrSheet({
        textName,
        teacher: values.teacher ?? '',
        students: students.map((s) => s.student_name),
        onlyFanSan,
      })
      const st = await pollExport(taskId)
      const blob = await downloadExport(taskId)
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
      const label = onlyFanSan ? '-举一反三' : ''
      // 优先用后端返回的文件名，保证与 zip 实际内容一致
      downloadZip(blob, st.fileName || `错题报告${label}-${textName}-${dateStr}.zip`)
      message.success('导出成功')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(null)
      setExportProgress(null)
    }
  }

  // 导出勾选学生的成绩分析报告：异步提交 → 轮询进度 → 下载 zip
  const handleExportScore = async () => {
    const students = selectedStudents()
    if (students.length === 0) return
    setExporting('score')
    setExportProgress('任务已提交，排队中...')
    try {
      const values = form.getFieldsValue()
      const textName = values.text_name ?? ''
      const teacher = values.teacher ?? ''
      const { taskId } = await submitExportScoreReport({
        textName,
        teacher,
        students: students.map((s) => s.student_name),
      })
      const st = await pollExport(taskId)
      const blob = await downloadExport(taskId)
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
      downloadZip(blob, st.fileName || `成绩分析报告-${textName}-${dateStr}.zip`)
      message.success('成绩报告导出成功')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(null)
      setExportProgress(null)
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
          {exportProgress && <Typography.Text type="secondary">{exportProgress}</Typography.Text>}
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
