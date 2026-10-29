import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/** 匹配 LaTeX 定界符：$$...$$、$...$、\[...\]、\(...\)（统一按行内公式渲染） */
const MATH_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g

/** 匹配完整 <table> 片段：整表提取渲染，避免分段清洗把表格结构拆坏 */
const TABLE_RE = /<table[\s\S]*?<\/table>/g

/**
 * 只保留行内标签：块级标签（<p> <div> 等）在分段清洗时会被补全成独立段落，
 * 导致紧跟的公式被挤到下一行，因此这里直接禁止块级标签。
 */
const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['u', 'sub', 'sup', 'b', 'strong', 'i', 'em', 'br', 'span', 'font', 'img'],
  ALLOWED_ATTR: ['src'],
}

/** 表格清洗：额外放行 table/tbody/thead/tr/th/td，用于整表清洗 */
const TABLE_SANITIZE_OPTIONS = {
  ...SANITIZE_OPTIONS,
  ALLOWED_TAGS: [...SANITIZE_OPTIONS.ALLOWED_TAGS, 'table', 'tbody', 'thead', 'tr', 'th', 'td'],
}

/** 普通文本段的换行转换为 <br>，多段落解析/答案按行展示 */
function withLineBreaks(text: string) {
  return text.replace(/\n/g, '<br/>')
}

/** 去掉公式两端的定界符，返回纯 LaTeX 表达式 */
function stripDelimiters(math: string) {
  if (math.startsWith('$$')) return math.slice(2, -2)
  if (math.startsWith('\\[')) return math.slice(2, -2)
  if (math.startsWith('\\(')) return math.slice(2, -2)
  if (math.startsWith('$')) return math.slice(1, -1)
  return math
}

/** 文本段（不含 <table>）：HTML 清洗 + LaTeX 公式渲染 */
function richSegToHTML(seg: string): string {
  let html = ''
  let lastIndex = 0
  for (const m of seg.matchAll(MATH_RE)) {
    const idx = m.index ?? 0
    if (idx > lastIndex) {
      html += DOMPurify.sanitize(withLineBreaks(seg.slice(lastIndex, idx)), SANITIZE_OPTIONS)
    }
    const latex = stripDelimiters(m[0])
    html += katex.renderToString(latex, { throwOnError: false, displayMode: false })
    lastIndex = idx + m[0].length
  }
  if (lastIndex < seg.length) {
    html += DOMPurify.sanitize(withLineBreaks(seg.slice(lastIndex)), SANITIZE_OPTIONS)
  }
  return html
}

/**
 * 渲染完整 <table>：先挖出单元格里的公式（占位符暂存），整表清洗后
 * 再把公式还原为 KaTeX。公式先挖出可以避免 $a<b$ 这类内容被清洗器误当标签。
 */
function renderTable(tableHTML: string): string {
  const maths: string[] = []
  const protectedTable = tableHTML.replace(MATH_RE, (m) => {
    maths.push(m)
    return `@@MATH${maths.length - 1}@@`
  })
  const clean = DOMPurify.sanitize(protectedTable, TABLE_SANITIZE_OPTIONS)
  return clean.replace(/@@MATH(\d+)@@/g, (_, i: string) =>
    katex.renderToString(stripDelimiters(maths[Number(i)]), { throwOnError: false, displayMode: false }),
  )
}

/**
 * 将包含 HTML 标签、表格与 LaTeX 公式的文本转换为可安全渲染的 HTML 字符串：
 * - 普通文本按 HTML 清洗（仅保留行内标签，换行转 <br>）
 * - <table> 整表提取渲染，单元格内公式同样支持
 * - LaTeX 公式段用 KaTeX 渲染，统一按行内公式展示
 */
export function richTextToHTML(text?: string | null): string {
  if (!text) return ''
  let html = ''
  let lastIndex = 0
  for (const m of text.matchAll(TABLE_RE)) {
    const idx = m.index ?? 0
    if (idx > lastIndex) {
      html += richSegToHTML(text.slice(lastIndex, idx))
    }
    html += renderTable(m[0])
    lastIndex = idx + m[0].length
  }
  if (lastIndex < text.length) {
    html += richSegToHTML(text.slice(lastIndex))
  }
  return html
}

interface RichContentProps {
  text?: string | null
}

/** 题目富文本渲染组件：HTML 标签 + 表格 + LaTeX 公式，适用于题目内容 / 答案 / 解析 */
export default function RichContent({ text }: RichContentProps) {
  if (!text) return null
  return <span className="rich-content" dangerouslySetInnerHTML={{ __html: richTextToHTML(text) }} />
}
