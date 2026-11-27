import { SearchOutlined } from '@ant-design/icons'
import { AutoComplete, Button, Input, Space, Table, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPaperList, getTextNameList } from '../api'
import type { Paper } from '../api/types'
import PaperQuestionsDrawer from '../components/PaperQuestionsDrawer'

/** 后端时间格式 "2026-11-27T10:17:55+08:00" → "2026-11-27 10:17" */
const formatTime = (iso?: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TextQuestions() {
  // ---------- 名称搜索（与试卷列表联动：输入即过滤列表） ----------
  const [paperName, setPaperName] = useState('')
  const [options, setOptions] = useState<{ value: string }[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // 右侧抽屉的查询关键词：非 null 时抽屉打开
  const [drawerQuery, setDrawerQuery] = useState<string | null>(null)

  // ---------- 试卷列表（一次拉全量，前端过滤 + 分页） ----------
  const [loading, setLoading] = useState(false)
  const [papers, setPapers] = useState<Paper[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // 卸载时清理防抖定时器
  useEffect(() => () => clearTimeout(timerRef.current), [])

  // 后端 paperList 仅支持 page/size 无名称过滤参数，试卷数量有限，一次拉全量便于前端过滤
  const fetchPapers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPaperList(1, 1000)
      setPapers(data.data ?? [])
    } catch (e) {
      setPapers([])
      message.error(e instanceof Error ? e.message : '获取试卷列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 进入页面即拉取试卷列表
  useEffect(() => {
    fetchPapers()
  }, [fetchPapers])

  // 关键词过滤试卷列表
  const filtered = useMemo(() => {
    const keyword = paperName.trim().toLowerCase()
    if (!keyword) return papers
    return papers.filter((p) => p.Name.toLowerCase().includes(keyword))
  }, [papers, paperName])

  // 查询按钮/回车：过滤已随输入实时生效；恰好一个匹配时直接打开抽屉查看
  const search = () => {
    const keyword = paperName.trim()
    if (!keyword) {
      message.warning('请输入试卷名称')
      return
    }
    if (filtered.length === 1) {
      setDrawerQuery(filtered[0].Name)
    } else if (filtered.length === 0) {
      message.info('未查询到试卷')
    } else {
      message.info(`找到 ${filtered.length} 份试卷，请点击名称查看`)
    }
  }

  // 输入即过滤列表，并防抖模糊查询试卷名作为下拉联想
  const handleSearch = (text: string) => {
    setPaperName(text)
    setPage(1)
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
        // 联想获取失败不打扰用户，列表过滤仍可用
      }
    }, 300)
  }

  // 选中联想项后以该名称过滤列表
  const handleSelect = (value: string) => {
    setPaperName(value)
    setPage(1)
  }

  const columns: ColumnsType<Paper> = [
    {
      title: '试卷名称',
      dataIndex: 'Name',
      render: (name: string) => (
        <Typography.Link onClick={() => setDrawerQuery(name)}>{name}</Typography.Link>
      ),
    },
    {
      title: '试卷 ID',
      dataIndex: 'PaperID',
      width: 240,
      render: (id: string) => (
        <Typography.Text type="secondary" copyable>
          {id}
        </Typography.Text>
      ),
    },
    { title: '更新时间', dataIndex: 'UpdatedAt', width: 170, render: formatTime },
  ]

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
          <Input placeholder="请输入试卷名称，如：2025五秋综合刷题16" onPressEnter={search} />
        </AutoComplete>
        <Button type="primary" icon={<SearchOutlined />} onClick={search}>
          查询
        </Button>
      </Space.Compact>

      {/*<Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>*/}
      {/*  试卷列表（点击名称查看试题）*/}
      {/*</Typography.Title>*/}

      <Table<Paper>
        rowKey="ID"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total: filtered.length,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (t) => `共 ${t} 份试卷`,
          onChange: (p, size) => {
            // 切换每页条数时回到第一页，避免当前页超出范围
            setPage(size !== pageSize ? 1 : p)
            setPageSize(size)
          },
        }}
      />

      <PaperQuestionsDrawer
        open={drawerQuery !== null}
        query={drawerQuery}
        onClose={() => setDrawerQuery(null)}
      />
    </div>
  )
}
