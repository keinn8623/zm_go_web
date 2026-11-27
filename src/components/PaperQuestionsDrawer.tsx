import { EditOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { checkTextField, getTextQuestions, updateQuestion } from '../api'
import type { QueryQueResult, QuestionList, TextFieldCheckResult } from '../api/types'
import QuestionBody from './QuestionBody'

/** 修改弹窗中可 AI 检查的三个字段 */
type EditField = 'content' | 'answer' | 'analysis'

const FIELD_LABELS: Record<EditField, string> = {
  content: '题干',
  answer: '答案',
  analysis: '解析',
}

interface PaperQuestionsDrawerProps {
  open: boolean
  /** 查询关键词：搜索框输入或列表试卷名（可能与后端返回的规范卷名不同）；null 时抽屉为空 */
  query: string | null
  onClose: () => void
}

/** 右侧抽屉：展示某份试卷的试题，逻辑与原题目查询页一致（列表 + 修改弹窗 + 单字段 AI 检查） */
export default function PaperQuestionsDrawer({ open, query, onClose }: PaperQuestionsDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryQueResult | null>(null)

  // 手动修改单题
  const [editing, setEditing] = useState<QuestionList | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm] = Form.useForm<{ content: string; answer: string; analysis: string }>()

  // 修改弹窗内单字段 AI 检查
  const [checkingField, setCheckingField] = useState<EditField | null>(null)
  const [fieldChecks, setFieldChecks] = useState<Partial<Record<EditField, TextFieldCheckResult>>>({})

  // 打开或切换查询关键词时重新拉取试题，并重置修改/检查状态
  useEffect(() => {
    setResult(null)
    setEditing(null)
    setFieldChecks({})
    setCheckingField(null)
    if (!open || !query) return
    let cancelled = false
    setLoading(true)
    getTextQuestions(query)
      .then((data) => {
        if (cancelled) return
        setResult(data)
        if (!data || (data.que_list ?? []).length === 0) {
          message.info('未查询到题目')
        }
      })
      .catch((e) => {
        if (cancelled) return
        setResult(null)
        const msg = e instanceof Error ? e.message : '查询失败'
        // 试卷不存在属于业务无数据（utils.ErrPaperNotFound），与错题页一致提示“无试卷数据”
        if (msg === 'paper not found') {
          message.info('无试卷数据')
        } else {
          message.error(msg)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, query])

  // 修改保存后按后端返回的规范卷名重新拉取（后端已失效缓存，取到的是最新内容）
  const refetchQuestions = async () => {
    const paperName = result?.paper_name ?? query
    if (!paperName) return
    try {
      const data = await getTextQuestions(paperName)
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
    if (!editing?.que_id || !query) {
      message.warning('该题目缺少题目 ID，无法保存')
      return
    }
    setSavingEdit(true)
    try {
      await updateQuestion({
        // 写库用后端返回的规范卷名；缓存键用查询关键词（可能与卷名不同，双键失效）
        paperName: result?.paper_name ?? query,
        queId: editing.que_id,
        content: values.content,
        answer: values.answer,
        analysis: values.analysis,
        cacheKeyName: query,
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
    <Drawer title={result?.paper_name ?? query ?? '试卷试题'} width={800} open={open} onClose={onClose}>
      {result && (
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          {result.paper_name}（共 {(result.que_list ?? []).length} 题）
        </Typography.Title>
      )}

      <List
        loading={loading}
        dataSource={result?.que_list ?? []}
        locale={{ emptyText: <Empty description="暂无题目" /> }}
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
    </Drawer>
  )
}
