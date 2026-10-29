import { Space, Tag } from 'antd'
import type { QuestionList } from '../api/types'
import RichContent from './RichContent'

interface QuestionBodyProps {
  question: QuestionList
}

/** 子题缩进区块：左侧色条 + 背景区分，子题无题号时用序号兜底 */
function ChildBlock({ question, index }: { question: QuestionList; index: number }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: '8px 12px',
        borderLeft: '3px solid #1677ff',
        background: '#fafafa',
        borderRadius: 4,
      }}
    >
      <Tag color="geekblue" style={{ marginBottom: 8 }}>
        {question.queNo || `子题 ${index + 1}`}
      </Tag>
      <QuestionBody question={question} />
    </div>
  )
}

/** 题目正文：题干（富文本 + 图片）、答案、解析，并递归展示子题 */
export default function QuestionBody({ question }: QuestionBodyProps) {
  const images = question.image ?? []
  const children = question.child ?? []
  return (
    <div>
      <div>
        <RichContent text={question.content} />
      </div>
      {images.length > 0 && (
        <Space wrap style={{ marginBottom: 8 }}>
          {images.map((src) => (
            <img key={src} src={src} alt={question.queNo} style={{ maxWidth: 260 }} />
          ))}
        </Space>
      )}
      <div>
        <strong>答案：</strong>
        <RichContent text={question.answer} />
      </div>
      <div style={{ color: '#999' }}>
        <strong>解析：</strong>
        <RichContent text={question.analysis} />
      </div>
      {children.map((child, i) => (
        <ChildBlock key={`${child.queNo}-${i}`} question={child} index={i} />
      ))}
    </div>
  )
}
