import { EditOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons'
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Modal,
  message,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import { checkTextField, getTextNameList, getTextQuestions, updateQuestion } from '../api'
import type { QueryQueResult, QuestionList, TextFieldCheckResult } from '../api/types'
import QuestionBody from '../components/QuestionBody'

/** 修改弹窗中可 AI 检查的三个字段 */
type EditField = 'content' | 'answer' | 'analysis'

const FIELD_LABELS: Record<EditField, string> = {
  content: '题干',
  answer: '答案',
  analysis: '解析',
}

export default function TextQuestions() {
  const [paperName, setPaperName] = useState('')
  const [options, setOptions] = useState<{ value: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryQueResult | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [lastQuery, setLastQuery] = useState('') // 搜索关键词（缓存键可能与卷名不同）

  // 手动修改单题
  const [editing, setEditing] = useState<QuestionList | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm] = Form.useForm<{ content: string; answer: string; analysis: string }>()

  // 修改弹窗内单字段 AI 检查
  const [checkingField, setCheckingField] = useState<EditField | null>(null)
  const [fieldChecks, setFieldChecks] = useState<Partial<Record<EditField, TextFieldCheckResult>>>({})

  // 卸载时清理防抖定时器
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const search = async (name?: string) => {
    const keyword = (name ?? paperName).trim()
    if (!keyword) {
      message.warning('请输入试卷名称')
      return
    }
    setLastQuery(keyword)
    setLoading(true)
    try {
      const data = await getTextQuestions(keyword)
      setResult(data)
      if (!data || (data.que_list ?? []).length === 0) {
        message.info('未查询到题目')
      }
    } catch (e) {
      setResult(null)
      const msg = e instanceof Error ? e.message : '查询失败'
      // 试卷不存在属于业务无数据（utils.ErrPaperNotFound），与错题页一致提示“无试卷数据”
      if (msg === 'paper not found') {
        message.info('无试卷数据')
      } else {
        message.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // 输入时防抖模糊查询试卷名，作为下拉联想
  const handleSearch = (text: string) => {
    setPaperName(text)
    clearTimeout(timerRef.current)
    const keyword = text.trim()
    if (!keyword) {
      setOptions([])
      return
    }
    timerRef.current = setTimeout(async () => {
      try {
        const names = await getTextNameList(keyword)
        setOptions(names.map((name) => ({ value: name })))
      } catch {
        // 联想获取失败不打扰用户，仍可手动查询
      }
    }, 300)
  }

  // 选中联想项后直接查询该试卷
  const handleSelect = (value: string) => {
    setPaperName(value)
    search(value)
  }

  // 修改保存后重新拉取试卷（后端已失效缓存，取到的是最新内容）
  const refetchQuestions = async () => {
    const name = result?.paper_name
    if (!name) return
    try {
      const data = await getTextQuestions(name)
      setResult(data)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '刷新题目失败')
    }
  }

  // ---------- 手动修改单题 ----------

  const openEdit = (question: QuestionList) => {
    setEditing(question)
    setFieldChecks({})
    setCheckingField(null)
    // 预填展示格式文本（图片由后端自动保留，无需在此编辑）
    editForm.setFieldsValue({
      content: question.content,
      answer: question.answer,
      analysis: question.analysis,
    })
  }

  const saveEdit = async () => {
    const values = await editForm.validateFields()
    if (!editing?.que_id || !result?.paper_name) {
      message.warning('该题目缺少题目 ID，无法保存')
      return
    }
    setSavingEdit(true)
    try {
      await updateQuestion({
        paperName: result.paper_name,
        queId: editing.que_id,
        content: values.content,
        answer: values.answer,
        analysis: values.analysis,
        cacheKeyName: lastQuery,
      })
      message.success('修改已保存')
      setEditing(null)
      refetchQuestions()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSavingEdit(false)
    }
  }

  // ---------- 单字段 AI 检查 ----------

  const handleFieldCheck = async (field: EditField) => {
    const text = editForm.getFieldValue(field) ?? ''
    if (!text.trim()) {
      message.warning(`${FIELD_LABELS[field]}为空，无法检查`)
      return
    }
    setCheckingField(field)
    try {
      const checkResult = await checkTextField(text, field)
      setFieldChecks((prev) => ({ ...prev, [field]: checkResult }))
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'AI 检查失败')
    } finally {
      setCheckingField(null)
    }
  }

  const applyFieldSuggestion = (field: EditField) => {
    const checkResult = fieldChecks[field]
    if (!checkResult?.corrected) return
    editForm.setFieldValue(field, checkResult.corrected)
    message.success('已应用修改意见，可继续调整后保存')
  }

  // 表单字段变化后清掉该字段的检查结果，避免误应用过期建议
  const handleEditValuesChange = (changed: Partial<Record<EditField, unknown>>) => {
    setFieldChecks((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(changed) as EditField[]) {
        next[key] = undefined
      }
      return next
    })
  }

  // 字段标签 + AI 检查按钮
  const renderFieldLabel = (field: EditField) => (
    <Space size={8}>
      <span>{FIELD_LABELS[field]}</span>
      <Button
        size="small"
        type="link"
        style={{ padding: 0 }}
        icon={<SafetyCertificateOutlined />}
        loading={checkingField === field}
        onClick={() => handleFieldCheck(field)}
      >
        AI 检查
      </Button>
    </Space>
  )

  // 渲染某个字段的 AI 检查结果（问题清单 + 一键应用）
  const renderFieldCheck = (field: EditField) => {
    const checkResult = fieldChecks[field]
    if (!checkResult) return null
    const { issues } = checkResult
    if (issues.length === 0) {
      return <Alert type="success" showIcon message="AI 检查未发现问题" style={{ marginBottom: 16 }} />
    }
    return (
      <Alert
        type="warning"
        showIcon
        message={`AI 检查发现 ${issues.length} 处问题`}
        description={
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {issues.map((issue, i) => (
              <li key={i}>
                <Typography.Text type="secondary">【{issue.reason}】</Typography.Text>{' '}
                {issue.original} → {issue.suggestion}
              </li>
            ))}
          </ul>
        }
        action={
          <Button size="small" type="primary" onClick={() => applyFieldSuggestion(field)}>
            应用修改意见
          </Button>
        }
        style={{ marginBottom: 16 }}
      />
    )
  }

  return (
    <div>
      <Space.Compact style={{ width: 400, marginBottom: 16 }}>
        <AutoComplete
          style={{ width: 300 }}
          value={paperName}
          options={options}
          onSearch={handleSearch}
          onSelect={handleSelect}
          allowClear
        >
          <Input placeholder="请输入试卷名称，如：2025五秋综合刷题16" onPressEnter={() => search()} />
        </AutoComplete>
        <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => search()}>
          查询
        </Button>
      </Space.Compact>

      {result && (
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          {result.paper_name}（共 {(result.que_list ?? []).length} 题）
        </Typography.Title>
      )}

      <List
        loading={loading}
        dataSource={result?.que_list ?? []}
        locale={{ emptyText: <Empty description="暂无数据，请输入试卷名称查询" /> }}
        renderItem={(question) => (
          <List.Item>
            <Card
              style={{ width: '100%' }}
              title={
                <Space>
                  <Tag color="blue">{question.queNo}</Tag>
                </Space>
              }
              extra={
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  disabled={!question.que_id}
                  onClick={() => openEdit(question)}
                >
                  修改
                </Button>
              }
            >
              <QuestionBody question={question} />
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title={`修改题目：${editing?.queNo ?? ''}`}
        open={!!editing}
        width={720}
        confirmLoading={savingEdit}
        onOk={saveEdit}
        onCancel={() => setEditing(null)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical" onValuesChange={handleEditValuesChange}>
          <Form.Item
            name="content"
            label={renderFieldLabel('content')}
            rules={[{ required: true, message: '请输入题干' }]}
          >
            <Input.TextArea rows={6} placeholder="题干（公式用 $...$，多行用回车）" />
          </Form.Item>
          {renderFieldCheck('content')}
          <Form.Item name="answer" label={renderFieldLabel('answer')}>
            <Input.TextArea rows={3} placeholder="答案" />
          </Form.Item>
          {renderFieldCheck('answer')}
          <Form.Item name="analysis" label={renderFieldLabel('analysis')}>
            <Input.TextArea rows={6} placeholder="解析" />
          </Form.Item>
          {renderFieldCheck('analysis')}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            内容为展示格式纯文本，题干中的图片会自动保留
          </Typography.Text>
        </Form>
      </Modal>
    </div>
  )
}
