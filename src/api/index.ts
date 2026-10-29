import request from './http'
import type {
  BatchCreateUsersResult,
  CheckJob,
  CreateUserParams,
  LoginResult,
  QueryQueResult,
  QueryScoreCondition,
  ScoreQueryResult,
  StudentErrQues,
  TextFieldCheckResult,
  UpdateQuestionParams,
  UploadExcelResult,
  User,
} from './types'

// ---------- 认证 ----------

/** 登录：POST /auth/login */
export function login(phone: string, password: string) {
  return request.post<LoginResult>('/auth/login', { phone, password })
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
