import { CheckCircleOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Collapse,
  Divider,
  Drawer,
  Empty,
  Input,
  Progress,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useMemo, useState } from 'react'
import { applyFix } from '../api'
import type { CheckIssue, CheckJob } from '../api/types'

const TYPE_TAG: Record<CheckIssue['type'], { color: string; label: string }> = {
  latex: { color: 'orange', label: '公式错误' },
  text: { color: 'red', label: '文字错误' },
  content: { color: 'purple', label: '内容错误' },
}

const FIELD_LABEL: Record<CheckIssue['field'], string> = {
  content: '题干',
  analysis: '解析',
}

interface Props {
  open: boolean
  job: CheckJob | null
  /** 前端搜索关键词：缓存键可能与卷名不同，应用修正时用于双键失效 */
  cacheKeyName: string
  onClose: () => void
  /** 应用修正后刷新背后的题目列表 */
  onRefetch: () => Promise<void>
}

export default function CheckResultDrawer({ open, job, cacheKeyName, onClose, onRefetch }: Props) {
  return (
    <Drawer title="AI 检查结果" width={640} open={open} onClose={onClose}>
      {!job ? (
        <Progress percent={0} status="active" format={() => '启动中…'} />
      ) : (
        <CheckResultContent job={job} cacheKeyName={cacheKeyName} onRefetch={onRefetch} />
      )}
    </Drawer>
  )
}

/** 实际内容：以 job_id 为 key 挂载，换任务自动重置草稿/应用状态 */
function CheckResultContent({
  job,
  cacheKeyName,
  onRefetch,
}: {
  job: CheckJob
  cacheKeyName: string
  onRefetch: () => Promise<void>
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [applying, setApplying] = useState<Record<string, boolean>>({})
  const [applied, setApplied] = useState<Record<string, boolean>>({})

  // 按题目分组展示
  const grouped = useMemo(() => {
    const map = new Map<string, CheckIssue[]>()
    for (const issue of job?.issues ?? []) {
      const list = map.get(issue.que_id) ?? []
      list.push(issue)
      map.set(issue.que_id, list)
    }
    return map
  }, [job?.issues])

  const issueKey = (issue: CheckIssue) => `${issue.que_id}|${issue.field}`
  const progressPercent = job && job.total > 0 ? Math.round((job.done / job.total) * 100) : 0

  const handleApply = async (issue: CheckIssue) => {
    if (!job) return
    const key = issueKey(issue)
    const text = (drafts[key] ?? issue.suggestion).trim()
    if (!text) {
      message.warning('修正内容不能为空')
      return
    }
    setApplying((prev) => ({ ...prev, [key]: true }))
    try {
      await applyFix({
        paperId: job.paper_id,
        queId: issue.que_id,
        field: issue.field,
        text,
        paperName: job.paper_name,
        cacheKeyName,
      })
      setApplied((prev) => ({ ...prev, [key]: true }))
      message.success('修正已应用')
      onRefetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '应用修正失败')
    } finally {
      setApplying((prev) => ({ ...prev, [key]: false }))
    }
  }

  const renderIssue = (issue: CheckIssue) => {
    const key = issueKey(issue)
    const done = applied[key]
    return (
      <div key={key} style={{ marginBottom: 16 }}>
        <Space wrap>
          <Tag color={TYPE_TAG[issue.type].color}>{TYPE_TAG[issue.type].label}</Tag>
          <Tag>{FIELD_LABEL[issue.field]}</Tag>
          {done && (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              已应用
            </Tag>
          )}
        </Space>
        {issue.original && (
          <Typography.Paragraph
            type="secondary"
            style={{
              background: '#f5f5f5',
              padding: 8,
              borderRadius: 4,
              whiteSpace: 'pre-wrap',
              maxHeight: 120,
              overflow: 'auto',
              marginBottom: 8,
            }}
          >
            {issue.original}
          </Typography.Paragraph>
        )}
        <Input.TextArea
          rows={4}
          value={drafts[key] ?? issue.suggestion}
          disabled={done}
          onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
        />
        <Space style={{ marginTop: 8 }}>
          <Button
            type="primary"
            size="small"
            loading={applying[key]}
            disabled={done}
            onClick={() => handleApply(issue)}
          >
            应用修正
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            suggestion 为字段修正后的完整文本，可编辑后应用
          </Typography.Text>
        </Space>
      </div>
    )
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <div>
        <Typography.Text strong>{job.paper_name}</Typography.Text>
        <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          共 {job.total} 题，已检查 {job.done} 题
        </Typography.Text>
      </div>

      {job.status === 'running' && (
        <Progress
          percent={progressPercent}
          status="active"
          format={() => `${job.done}/${job.total}`}
        />
      )}
      {job.status === 'done' && (
        <Progress percent={100} success={{ percent: 100 }} format={() => `${job.done}/${job.total}`} />
      )}
      {job.status === 'error' && (
        <Alert type="warning" showIcon message={job.err || '检查异常结束'} />
      )}

      {job.status === 'done' && (job.issues ?? []).length === 0 && (
        <Empty description="未发现问题" />
      )}

      {[...grouped.entries()].map(([queId, issues]) => (
        <div key={queId}>
          <Divider titlePlacement="left" plain>
            <Typography.Text strong>{issues[0].que_no}</Typography.Text>
          </Divider>
          {issues.map(renderIssue)}
        </div>
      ))}

      {(job.errors ?? []).length > 0 && (
        <Collapse
          items={[
            {
              key: 'errors',
              label: `检查失败 ${job.errors!.length} 题`,
              children: (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {job.errors!.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      )}
    </Space>
  )
}
