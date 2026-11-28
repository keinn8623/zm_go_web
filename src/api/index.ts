import request from './http'
import type {
  BatchCreateUsersResult,
  CheckJob,
  CreateUserParams,
  LoginResult,
  PaperListResult,
  PdfJobState,
  QueryQueResult,
  QueryScoreCondition,
  ScoreQueryResult,
  StudentErrQues,
  TextFieldCheckResult,
  UpdateQuestionParams,
  UpdateUserParams,
  UploadExcelResult,
  User,
} from './types'

// ---------- 认证 ----------

/** 登录：POST /auth/login；remember=true 时服务端签发 7 天 token（默认 6 小时） */
export function login(phone: string, password: string, remember = false) {
  return request.post<LoginResult>('/auth/login', { phone, password, remember })
}

// ---------- 用户 ----------

/** 用户列表：GET /users/getUserList */
export function getUserList() {
  return request.get<User[]>('/users/getUserList')
}

/** 新建用户：POST /users/createUser */
export function createUser(user: CreateUserParams) {
  return request.post<string>('/users/createUser', user)
}

/** 批量导入用户：POST /users/batchCreateUsers（multipart/form-data，文件字段名 user_excel） */
export function batchCreateUsers(file: File) {
  const formData = new FormData()
  formData.append('user_excel', file)
  return request.post<BatchCreateUsersResult>('/users/batchCreateUsers', formData)
}

/** 更新用户：POST /users/updateUser?id=xxx（GORM Updates 只更新非零字段，password 留空不修改） */
export function updateUser(id: number, payload: UpdateUserParams) {
  return request.post<string>('/users/updateUser', payload, { params: { id } })
}

/** 删除用户（软删除）：GET /users/deleteUser?id=xxx 或 ?id=1,2,3，支持单个或多个 id */
export function deleteUser(ids: number | number[]) {
  const list = Array.isArray(ids) ? ids : [ids]
  return request.get<{ deleted: number; ids: number[] }>('/users/deleteUser', {
    params: { id: list.join(',') },
  })
}

// ---------- 成绩 ----------

/** 成绩查询（多条件）：POST /score/getUserScoreDataList，返回按考试名称分组的结果 */
export function getUserScoreDataList(condition: QueryScoreCondition) {
  return request.post<Record<string, ScoreQueryResult[]>>(
    '/score/getUserScoreDataList',
    condition,
  )
}

/** 上传 Excel 导入成绩：POST /score/uploadExcel（multipart/form-data，仅支持 .xlsx / .xlsm） */
export function uploadExcel(file: File) {
  const formData = new FormData()
  formData.append('excel', file)
  return request.post<UploadExcelResult>('/score/uploadExcel', formData)
}

// ---------- 题目 ----------

/** 试卷题目查询：GET /score/getTextQuestions?paperName=xxx */
export function getTextQuestions(paperName: string) {
  return request.get<QueryQueResult>('/score/getTextQuestions', {
    params: { paperName },
  })
}

/** 试卷名称模糊查询：GET /score/getTextNameList?textName=xxx */
export function getTextNameList(textName: string) {
  return request.get<string[]>('/score/getTextNameList', {
    params: { textName },
  })
}

/**
 * 试卷列表：GET /analyze/paperList?page=xxx&size=xxx
 * 无数据时后端返回 204 空响应体（response.NoContent），归一化为空列表。
 */
export async function getPaperList(page: number, size: number) {
  const result = await request.get<PaperListResult | ''>('/analyze/paperList', {
    params: { page, size },
  })
  return result && typeof result === 'object' ? result : { data: [], total: 0 }
}

/** 手动修改单题：POST /score/updateQuestion（写库并失效 Redis 缓存） */
export function updateQuestion(payload: UpdateQuestionParams) {
  return request.post<null>('/score/updateQuestion', payload)
}

// ---------- 错题 ----------

/** 班级错题查询：GET /score/getClassTest?textName=xxx&teacher=xxx */
export function getClassErrQuestions(textName: string, teacher: string) {
  return request.get<StudentErrQues[]>('/score/getClassTest', {
    params: { textName, teacher },
  })
}

/** 学生错题查询：GET /score/getTest?studentName=xxx&textName=xxx&teacher=xxx */
export function getStudentErrQuestions(studentName: string, textName: string, teacher: string) {
  return request.get<StudentErrQues>('/score/getTest', {
    params: { studentName, textName, teacher },
  })
}

// ---------- 错题卷导出 ----------

export interface ExportErrSheetParams {
  textName: string
  teacher: string
  students: string[]
  /** 只导出举一反三错题（默认 false：温故知新 + 举一反三 全部导出） */
  onlyFanSan?: boolean
}

/**
 * 导出错题卷：POST /score/exportErrSheet
 * 后端以 worksheet.ts 为模板为每个学生生成两份 HTML（学生版 / 带答案版）并打包 zip 返回。
 * 生成耗时与学生数成正比，超时放宽到 10 分钟。
 */
export function exportErrSheet(params: ExportErrSheetParams) {
  return request.post<Blob>('/score/exportErrSheet', params, {
    responseType: 'blob',
    timeout: 600000,
  })
}

/**
 * 导出成绩分析报告：POST /score/exportScoreReport
 * 后端以 scoreReport.ts 为模板生成 A4 PDF（数据来自成绩分析接口），打包 zip 返回。
 * 只导出 students 名单内的学生；超时放宽到 10 分钟。
 */
export function exportScoreReport(params: { textName: string; teacher: string; students: string[] }) {
  return request.post<Blob>('/score/exportScoreReport', params, {
    responseType: 'blob',
    timeout: 600000,
  })
}

// ---------- PDF 异步导出（提交 → 轮询 → 下载） ----------

/**
 * 异步导出错题卷：POST /score/exportErrSheetAsync
 * 立即返回任务 ID（202），由后端 RabbitMQ 单消费者串行渲染（防 OOM），
 * 前端轮询 exportProgress 直到 done 后走 exportDownload 下载 zip。
 */
export function submitExportErrSheet(params: ExportErrSheetParams) {
  return request.post<{ taskId: string; status: string }>('/score/exportErrSheetAsync', params)
}

/** 异步导出成绩分析报告：POST /score/exportScoreReportAsync（students 可空 = 全班） */
export function submitExportScoreReport(params: { textName: string; teacher: string; students?: string[] }) {
  return request.post<{ taskId: string; status: string }>('/score/exportScoreReportAsync', params)
}

/** 查询导出进度：GET /score/exportProgress?taskId=xxx（约 2s 轮询一次） */
export function getExportProgress(taskId: string) {
  return request.get<PdfJobState>('/score/exportProgress', {
    params: { taskId },
    timeout: 30000,
  })
}

/** 下载导出产物：GET /score/exportDownload?taskId=xxx（大 zip 放宽到 10 分钟） */
export function downloadExport(taskId: string) {
  return request.get<Blob>('/score/exportDownload', {
    params: { taskId },
    responseType: 'blob',
    timeout: 600000,
  })
}

// ---------- 爬虫抓题 ----------

/** 爬虫抓题：GET /score/testCrawler?clientToken=xxx&cookieStr=xxx&paperID=xxx（抓取外部题库并入库） */
export function testCrawler(clientToken: string, cookieStr: string, paperID: string) {
  return request.get<string>('/score/testCrawler', {
    params: { clientToken, cookieStr, paperID },
    timeout: 120000,
  })
}

// ---------- AI 检查 ----------

/** 启动整卷 AI 检查：POST /score/checkQuestions，返回任务 ID */
export function startCheckQuestions(paperName: string) {
  return request.post<{ jobId: string }>('/score/checkQuestions', { paperName })
}

/** 查询检查进度：GET /score/checkProgress?jobId=xxx（约 2s 轮询一次） */
export function getCheckProgress(jobId: string) {
  return request.get<CheckJob>('/score/checkProgress', {
    params: { jobId },
    timeout: 60000,
  })
}

/** 应用一条修正：POST /score/applyFix（写库并失效 Redis 缓存） */
export function applyFix(payload: {
  paperId: string
  queId: string
  field: 'content' | 'analysis'
  text: string
  paperName: string
  cacheKeyName: string
}) {
  return request.post<null>('/score/applyFix', payload)
}

/**
 * 单字段 AI 检查：POST /score/checkTextField
 * 对修改弹窗中题干/答案/解析的任一段文本做同步检查，返回问题清单与修正后完整文本。
 * 同步调用 DeepSeek，超时放宽到 60s。
 */
export function checkTextField(text: string, field: 'content' | 'answer' | 'analysis') {
  return request.post<TextFieldCheckResult>('/score/checkTextField', { text, field }, {
    timeout: 60000,
  })
}
