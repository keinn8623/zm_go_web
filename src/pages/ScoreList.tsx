import { SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, Col, Form, Input, message, Row, Table, Upload } from 'antd'
import type { ColumnGroupType, ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import { getUserScoreDataList, uploadExcel } from '../api'
import type { QueryScoreCondition, ScoreQueryResult } from '../api/types'

// 分数与得分率统一保留一位小数（排名为整数，不格式化）
const fmt1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-')
const renderRate = (v: number) => `${fmt1(v)}%`

type ModulePrefix =
  | 'computation'
  | 'count'
  | 'geometric'
  | 'travel'
  | 'combination'
  | 'application'
  | 'number_theory'

/** 各模块分组列：模块总分 / 模块得分 / 模块总分率 / 模块得分率 */
const moduleColumns = (title: string, prefix: ModulePrefix): ColumnGroupType<ScoreQueryResult> => ({
  title,
  key: prefix,
  children: [
    { title: '模块总分', dataIndex: `${prefix}_total_score` as keyof ScoreQueryResult, width: 90, render: fmt1 },
    { title: '模块得分', dataIndex: `${prefix}_score` as keyof ScoreQueryResult, width: 90, render: fmt1 },
    { title: '模块总分率', dataIndex: `${prefix}_total_rate` as keyof ScoreQueryResult, width: 110, render: renderRate },
    { title: '模块得分率', dataIndex: `${prefix}_rate` as keyof ScoreQueryResult, width: 110, render: renderRate },
  ],
})

const columns: ColumnsType<ScoreQueryResult> = [
  { title: '姓名', dataIndex: 'username', fixed: 'left', width: 100 },
  { title: '考试名称', dataIndex: 'text_name', fixed: 'left', width: 200 },
  { title: '校区', dataIndex: 'campus', width: 120 },
  { title: '试卷总分', dataIndex: 'text_score', width: 90, render: fmt1 },
  {
    title: '学生总分',
    dataIndex: 'stu_score',
    width: 110,
    sorter: (a, b) => a.stu_score - b.stu_score,
    render: fmt1,
  },
  { title: '排名', dataIndex: 'rank', width: 80, sorter: (a, b) => a.rank - b.rank },
  { title: '最高分', dataIndex: 'max_score', width: 90, render: fmt1 },
  { title: '最低分', dataIndex: 'min_score', width: 90, render: fmt1 },
  { title: '平均分', dataIndex: 'average_score', width: 90, render: fmt1 },
  moduleColumns('计算', 'computation'),
  moduleColumns('计数', 'count'),
  moduleColumns('几何', 'geometric'),
  moduleColumns('行程', 'travel'),
  moduleColumns('组合', 'combination'),
  moduleColumns('应用', 'application'),
  moduleColumns('数论', 'number_theory'),
]

export default function ScoreList() {
  const [form] = Form.useForm<QueryScoreCondition>()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ScoreQueryResult[]>([])

  const loadData = useCallback(async (condition: QueryScoreCondition = {}) => {
    setLoading(true)
    try {
      // 后端返回按考试名称分组的结果，这里拍平成表格行
      const grouped = await getUserScoreDataList(condition)
      setData(Object.values(grouped ?? {}).flat())
    } catch (e) {
      message.error(e instanceof Error ? e.message : '查询失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onSearch = () => {
    loadData(form.getFieldsValue())
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={onSearch}>
          <Form.Item name="username" label="姓名">
            <Input placeholder="学生姓名" allowClear />
          </Form.Item>
          <Form.Item name="text_name" label="考试名称">
            <Input placeholder="考试名称" allowClear />
          </Form.Item>
          <Form.Item name="campus" label="校区">
            <Input placeholder="校区" allowClear />
          </Form.Item>
          <Form.Item name="teacher" label="教师">
            <Input placeholder="教师" allowClear />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
              查询
            </Button>
          </Form.Item>
          <Form.Item>
            <Upload
              accept=".xlsx,.xlsm"
              showUploadList={false}
              customRequest={async ({ file, onSuccess, onError }) => {
                try {
                  const result = await uploadExcel(file as File)
                  message.success(`导入成功：${result.sheet} 共 ${result.total} 行`)
                  onSuccess?.(result)
                  loadData()
                } catch (e) {
                  message.error(e instanceof Error ? e.message : '导入失败')
                  onError?.(e as Error)
                }
              }}
            >
              <Button icon={<UploadOutlined />}>导入 Excel</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Card>
      <Row gutter={16}>
        <Col span={24}>
          <Table<ScoreQueryResult>
            rowKey={(record) => `${record.text_id}-${record.username}`}
            columns={columns}
            dataSource={data}
            loading={loading}
            scroll={{ x: 3800 }}
            pagination={{
              // 与 UserList 相同：用 defaultPageSize 而非 pageSize，否则静态受控值
              // 会让每页条数切换失效，永远停在 20 条/页
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </Col>
      </Row>
    </div>
  )
}
