// 与后端 internal/model 保持一致的 TypeScript 类型定义

/** 后端统一响应结构：{ code, msg, data }，code=0 表示成功 */
export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

/** 登录返回（POST /auth/login） */
export interface LoginResult {
  token: string
  user: User
}

/** 用户（model.User） */
export interface User {
  id: number
  username: string
  phone: string
  password?: string
  campus?: string
  role?: string
  deleted?: number
  created_at?: string
  updated_at?: string
}

/** 新建用户入参（model.CUser） */
export interface CreateUserParams {
  username: string
  phone: string
  password: string
  confirmPsw: string
  campus?: string
  role?: string
}

/** 更新用户入参（model.UUser）；password 留空表示不修改密码（后端 GORM 只更新非零字段） */
export interface UpdateUserParams {
  username: string
  phone: string
  password?: string
  campus?: string
  role: string
}

/** 成绩查询条件（model.QueryScoreCondition） */
export interface QueryScoreCondition {
  username?: string
  text_name?: string
  campus?: string
  teacher?: string
  start_time?: string
  end_time?: string
}

/** 成绩查询结果（model.ScoreQueryResult） */
export interface ScoreQueryResult {
  username: string
  text_name: string
  campus: string
  text_id: number
  text_score: number // 试卷总分
  stu_score: number // 学生总分
  rank: number
  max_score: number
  min_score: number
  average_score: number
  // 计算模块
  computation_total_score: number
  computation_score: number
  computation_total_rate: number
  computation_rate: number
  // 计数模块
  count_total_score: number
  count_score: number
  count_total_rate: number
  count_rate: number
  // 几何模块
  geometric_total_score: number
  geometric_score: number
  geometric_total_rate: number
  geometric_rate: number
  // 行程模块
  travel_total_score: number
  travel_score: number
  travel_total_rate: number
  travel_rate: number
  // 组合模块
  combination_total_score: number
  combination_score: number
  combination_total_rate: number
  combination_rate: number
  // 应用模块
  application_total_score: number
  application_score: number
  application_total_rate: number
  application_rate: number
  // 数论模块
  number_theory_total_score: number
  number_theory_score: number
  number_theory_total_rate: number
  number_theory_rate: number
}

/** 题目（model.QuestionList） */
export interface QuestionList {
  /** 题目唯一 ID（手动修改接口需要；历史数据可能缺失） */
  que_id?: string
  queNo: string
  content: string
  // 后端 nil 切片会序列化为 null，故允许 null
  image?: string[] | null
  answer: string
  analysis: string
  analysis_images?: string[] | null
  child?: QuestionList[] | null
}

/** 试卷题目查询结果（model.QueryQueResult） */
export interface QueryQueResult {
  paper_name: string
  que_list?: QuestionList[] | null
}

/** 手动修改单题入参（POST /score/updateQuestion） */
export interface UpdateQuestionParams {
  paperName: string
  queId: string
  content: string
  answer: string
  analysis: string
  /** 前端搜索关键词：缓存键可能与卷名不同，用于双键失效 */
  cacheKeyName: string
}

/** 学生错题（model.StudentErrQues） */
export interface StudentErrQues {
  student_name: string
  teacher: string
  question_list: QueryQueResult
}

/** Excel 导入返回（POST /score/uploadExcel，非统一结构） */
export interface UploadExcelResult {
  message: string
  sheet: string
  total: number
  data: unknown
}

/** 用户批量导入返回（POST /users/batchCreateUsers，非统一结构） */
export interface BatchCreateUsersResult {
  message: string
  sheet: string
  total: number
  data: {
    total_count: number
    success_count: number
    fail_count: number
    skip_count: number
    status: 'all_success' | 'partial_success' | 'all_fail'
    failed_list?: { username: string; phone: string; reason: string }[]
  } | null
}

/** OCR 解析返回（POST /score/testOCR，非统一结构） */
export interface OCRResult {
  markdown_path: string
  image_count: number
  preview: string
}

/** AI 检查问题（model.CheckIssue） */
export interface CheckIssue {
  que_id: string
  que_no: string
  field: 'content' | 'analysis'
  type: 'latex' | 'text' | 'content'
  /** 问题片段（截断展示） */
  original: string
  /** 修正后完整字段文本 */
  suggestion: string
}

/** 单字段 AI 检查问题（model.TextFieldIssue，POST /score/checkTextField） */
export interface TextFieldIssue {
  /** 问题片段（截断展示） */
  original: string
  /** 错误类型/原因 */
  reason: string
  /** 该片段的修改建议 */
  suggestion: string
}

/** 单字段 AI 检查结果（model.TextFieldCheckResult） */
export interface TextFieldCheckResult {
  issues: TextFieldIssue[]
  /** 修正后完整文本（无问题时与原文一致） */
  corrected: string
}

/** AI 检查任务（model.CheckJob） */
export interface CheckJob {
  job_id: string
  paper_id: string
  paper_name: string
  status: 'running' | 'done' | 'error'
  total: number
  done: number
  issues: CheckIssue[]
  /** 单题失败列表（不中断整卷） */
  errors: string[]
  /** 全局错误（如整体超时） */
  err: string
  created_at: string
}
