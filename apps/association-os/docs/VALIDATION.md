# 交接验证记录

日期：2026-10-28；Windows，Node 26.7.0，pnpm 11.10.0。

- 新版干净副本 `pnpm install --frozen-lockfile` 成功；未复制旧环境文件、数据库或依赖目录。
- 新版 `pnpm lint`：0 errors，4 个既有 warnings。
- 新版 `pnpm test`：41/41 通过；`pnpm build` 包括 TypeScript 检查通过。
- 新版生产进程在本机独立端口 3103 启动；九个公开页面及 /login 均 HTTP 200，未出现浏览器 Basic 登录挑战。
- 新副本未配置管理员凭据，管理 API 返回预期的 503；管理员登录和 CRUD 采用自动化 fixture 验证，本次未使用真实账号。
- `/api/meta` 返回 dataSource=seed、schemaVersion=3，未迁移真实数据。
- 旧站 `npm run test`：44/44 通过；`npm run build`：52 页；`npm run test:smoke` 通过。
- 旧站沿用 onlyBuiltDependencies 配置，pnpm 11 安装曾因 ignored build scripts 返回非零；依赖已落盘，随后通过 npm 运行原 scripts 完成验证。未扩大依赖脚本许可，也未提交 pnpm 自动插入的占位配置。旧站协作者应继续使用其已有工作环境；本轮不宣称旧站 pnpm 11 全流程安装通过。
- 新版独立 Vitest/TypeScript 范围配置避免根目录测试收集新版 Node 测试。旧站业务源码、内容及线上配置没有改动。
- 待上传快照检查未包含 .env、数据库、data/、node_modules 或构建文件；常见私钥、GitHub/API key、AWS key 和凭据 URL 模式无命中。此为有限模式检查，不是完整安全审计。

本轮仅增加交接资料和双应用集成配置，沿用前轮 Hero/响应式浏览器证据，没有新增视觉重设计或独立视觉总监批准。真实服务器、HTTPS 反代、数据库恢复、旧站迁移尚未验证。
