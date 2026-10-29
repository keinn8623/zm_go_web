# zm-web — 教育考试系统前端

基于 React + TypeScript + Vite + Ant Design 的前端项目，对接后端 Go 服务（`goproject_zm`，默认 `http://localhost:8080`）。

## 技术栈

- React 19 + TypeScript
- Vite 8（开发服务器 + 构建）
- Ant Design（UI 组件库，中文 locale）
- React Router（路由）
- Axios（HTTP 客户端，统一解包后端 `{code, msg, data}` 响应结构）

## 快速开始

```bash
npm install
npm run dev    # 开发模式，默认 http://localhost:5173
npm run build  # 生产构建，产物在 dist/
```

> 开发环境已配置代理：`/auth`、`/users`、`/score`、`/output`、`/migrate` 均转发到
> `http://localhost:8080`（见 `vite.config.ts`），无需处理跨域。
> 启动前请先运行后端服务（`goproject_zm` 目录下 `go run main.go`）。

## 页面与后端接口对应关系

| 页面 | 路由 | 后端接口 |
| ---- | ---- | ---- |
| 登录 | `/login` | `POST /auth/login` |
| 成绩查询 | `/scores` | `POST /score/getUserScoreDataList`、`POST /score/uploadExcel`（Excel 导入） |
| 题目查询 | `/questions` | `GET /score/getTextQuestions?paperName=` |
| 错题管理 | `/err-questions` | `GET /score/getClassTest`（后端当前为测试实现） |
| 用户列表 | `/users` | `GET /users/getUserList` |

## 项目结构

```
├── vite.config.ts        # Vite 配置（后端代理）
├── src/
│   ├── api/
│   │   ├── types.ts      # 与后端 internal/model 对齐的 TS 类型
│   │   ├── http.ts       # axios 实例：JWT 携带、统一响应解包、401 跳转
│   │   └── index.ts      # 接口函数（login / getUserList / getUserScoreDataList ...）
│   ├── pages/
│   │   ├── Login.tsx         # 登录页
│   │   ├── AppLayout.tsx     # 侧边栏布局 + 退出登录
│   │   ├── ScoreList.tsx     # 成绩查询 + Excel 导入
│   │   ├── TextQuestions.tsx # 试卷题目查询
│   │   ├── ErrQuestions.tsx  # 班级错题查询
│   │   └── UserList.tsx      # 用户列表
│   ├── App.tsx           # 路由配置（含登录守卫 RequireAuth）
│   └── main.tsx          # 入口（antd ConfigProvider 中文 locale）
```

## 约定

- 登录成功后 `token` 与 `user` 存于 `localStorage`，axios 请求拦截器自动携带
  `Authorization: Bearer <token>`；401 时自动清除并跳转登录页
- 后端统一响应 `{code, msg, data}`：`code=0` 时拦截器直接返回 `data`，
  否则抛出带 `msg` 的 Error；`uploadExcel` / `testOCR` 等非统一结构接口原样透传
- 后端新增接口时：在 `src/api/types.ts` 补类型 → `src/api/index.ts` 加函数 → 页面调用

## 待办

- 错题管理页目前对接的是后端测试接口（mock 数据），后端完善后替换为正式接口
- 登录页未对接注册（`POST /users/createUser`），可按需补充
- antd 全量引入导致首包较大（约 1.1MB），后续可配置按需加载或代码分割
