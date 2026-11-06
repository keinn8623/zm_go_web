import { DeleteOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { Key } from 'react'
import { batchCreateUsers, createUser, deleteUser, getUserList, updateUser } from '../api'
import type { BatchCreateUsersResult, CreateUserParams, UpdateUserParams, User } from '../api/types'

const columns: ColumnsType<User> = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '用户名', dataIndex: 'username', width: 150 },
  { title: '手机号', dataIndex: 'phone', width: 140 },
  { title: '校区', dataIndex: 'campus', width: 150 },
  {
    title: '角色',
    dataIndex: 'role',
    width: 100,
    render: (role: string) => <Tag color={role === 'student' ? 'blue' : 'green'}>{role}</Tag>,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    width: 180,
    render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
  },
]

/** 导入失败明细列（BatchCreateResult.FailedUser） */
const failedColumns: ColumnsType<{ username: string; phone: string; reason: string }> = [
  { title: '用户名', dataIndex: 'username', width: 120 },
  { title: '手机号', dataIndex: 'phone', width: 140 },
  { title: '失败原因', dataIndex: 'reason' },
]

const ROLE_OPTIONS = [
  { value: 'student', label: '学生' },
  { value: 'teacher', label: '教师' },
  { value: 'admin', label: '管理员' },
]

export default function UserList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<User[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<CreateUserParams>()
  // 批量导入 Excel
  const [importing, setImporting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importResult, setImportResult] = useState<BatchCreateUsersResult | null>(null)
  // 勾选行：勾选后出现批量删除按钮
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)
  // 手动修改单个用户
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm] = Form.useForm<UpdateUserParams>()

  // 按登录用户角色控制可见范围：admin 可查看全部用户，teacher 仅可查看 student 角色
  const raw = localStorage.getItem('user')
  const currentUser: User | null = raw ? (JSON.parse(raw) as User) : null
  const isTeacher = currentUser?.role === 'teacher'
  // admin / teacher 可新建用户，student 无新建权限
  const canCreate = currentUser?.role === 'admin' || currentUser?.role === 'teacher'
  // admin 可注册所有角色，teacher 只能注册 teacher / student
  const roleOptions =
    currentUser?.role === 'admin'
      ? ROLE_OPTIONS
      : ROLE_OPTIONS.filter((o) => o.value !== 'admin')

  const fetchList = () => {
    setLoading(true)
    getUserList()
      .then((list) => {
        const users = list ?? []
        setData(isTeacher ? users.filter((u) => u.role === 'student') : users)
      })
      .catch((e) => message.error(e instanceof Error ? e.message : '查询失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (values: CreateUserParams) => {
    setSubmitting(true)
    try {
      await createUser(values)
      message.success('创建成功')
      setModalOpen(false)
      form.resetFields()
      fetchList()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- 勾选后的行操作 ----------

  const openEdit = (user: User) => {
    setEditingUser(user)
    editForm.setFieldsValue({
      username: user.username,
      phone: user.phone,
      campus: user.campus,
      role: user.role,
    })
  }

  const onEditSubmit = async (values: UpdateUserParams) => {
    if (!editingUser) return
    setSavingEdit(true)
    try {
      await updateUser(editingUser.id, values)
      message.success('修改成功')
      setEditingUser(null)
      fetchList()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '修改失败')
    } finally {
      setSavingEdit(false)
    }
  }

  const onDelete = async (user: User) => {
    try {
      await deleteUser(user.id)
      message.success('删除成功')
      // 被删行移出勾选，避免残留
      setSelectedRowKeys((keys) => keys.filter((k) => k !== user.id))
      fetchList()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  // 批量删除：一次请求把多个 id 交给后端，后端软删除并返回实际删除的 id 列表
  const onBatchDelete = async () => {
    setBatchDeleting(true)
    try {
      const result = await deleteUser(selectedRowKeys.map(Number))
      const failed = selectedRowKeys.length - result.deleted
      message.success(
        `已删除 ${result.deleted} 个用户${failed > 0 ? `，${failed} 个未删除（不存在或已删除）` : ''}`,
      )
      setSelectedRowKeys([])
      fetchList()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '批量删除失败')
    } finally {
      setBatchDeleting(false)
    }
  }

  // 操作列：放在创建时间列之后，每行固定展示修改/删除图标
  const actionColumn: ColumnsType<User> = [
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            aria-label="修改"
            onClick={() => openEdit(record)}
          />
          <Popconfirm
            title="确认删除该用户？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(record)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} aria-label="删除" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 上传 Excel 批量导入用户：成功后弹窗展示汇总与失败明细，有成功数据则刷新列表
  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const result = await batchCreateUsers(file)
      if (!result) {
        message.info('Excel 为空，未导入任何数据')
        return
      }
      setImportResult(result)
      setImportOpen(true)
      if ((result.data?.success_count ?? 0) > 0) {
        fetchList()
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      {canCreate && (
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button type="primary" onClick={() => setModalOpen(true)}>
              新建用户
            </Button>
            <Upload
              accept=".xlsx,.xlsm"
              showUploadList={false}
              customRequest={async ({ file }) => {
                await handleImport(file as File)
              }}
            >
              <Button icon={<UploadOutlined />} loading={importing}>
                导入 Excel
              </Button>
            </Upload>
          </Space>
        </div>
      )}
      {selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Typography.Text>已选 {selectedRowKeys.length} 个用户</Typography.Text>
            <Popconfirm
              title={`确认删除选中的 ${selectedRowKeys.length} 个用户？`}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={onBatchDelete}
            >
              <Button danger icon={<DeleteOutlined />} loading={batchDeleting}>
                批量删除
              </Button>
            </Popconfirm>
            <Button onClick={() => setSelectedRowKeys([])}>取消选择</Button>
          </Space>
        </div>
      )}
      <Table<User>
        rowKey="id"
        columns={[...columns, ...actionColumn]}
        dataSource={data}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        pagination={{
          // 用 defaultPageSize 而非 pageSize：传静态 pageSize 会被当作受控值，
          // 切换每页条数后又被覆盖回去，导致只能停在 10 条/页
          defaultPageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (total) => `共 ${total} 条`,
        }}
      />
      <Modal
        title="新建用户"
        open={modalOpen}
        confirmLoading={submitting}
        onOk={() => form.submit()}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
      >
        <Form<CreateUserParams>
          form={form}
          layout="vertical"
          initialValues={{ role: 'student' }}
          onFinish={onSubmit}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '手机号格式不正确' },
            ]}
          >
            <Input placeholder="请输入手机号" maxLength={11} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item
            name="confirmPsw"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入密码" />
          </Form.Item>
          <Form.Item name="campus" label="校区">
            <Input placeholder="请输入校区" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roleOptions} placeholder="请选择角色" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={`修改用户：${editingUser?.username ?? ''}`}
        open={!!editingUser}
        confirmLoading={savingEdit}
        onOk={() => editForm.submit()}
        onCancel={() => {
          setEditingUser(null)
          editForm.resetFields()
        }}
      >
        <Form<UpdateUserParams> form={editForm} layout="vertical" onFinish={onEditSubmit}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '手机号格式不正确' },
            ]}
          >
            <Input placeholder="请输入手机号" maxLength={11} />
          </Form.Item>
          <Form.Item name="password" label="密码">
            <Input.Password placeholder="留空则不修改密码" />
          </Form.Item>
          <Form.Item name="campus" label="校区">
            <Input placeholder="请输入校区" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roleOptions} placeholder="请选择角色" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="导入结果"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        footer={
          <Button type="primary" onClick={() => setImportOpen(false)}>
            关闭
          </Button>
        }
      >
        {importResult && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Typography.Text strong>{importResult.message}</Typography.Text>
            <Space wrap>
              <Tag color="blue">共 {importResult.total} 条</Tag>
              <Tag color="green">成功 {importResult.data?.success_count ?? 0}</Tag>
              <Tag color="orange">已存在跳过 {importResult.data?.skip_count ?? 0}</Tag>
              <Tag color="red">失败 {importResult.data?.fail_count ?? 0}</Tag>
            </Space>
            {(importResult.data?.failed_list ?? []).length > 0 && (
              <Table
                size="small"
                rowKey={(_, i) => String(i)}
                columns={failedColumns}
                dataSource={importResult.data!.failed_list}
                pagination={false}
              />
            )}
          </Space>
        )}
      </Modal>
    </>
  )
}
