# 新版协作交接

日期：2026-10-28。本文件描述 Next.js 新版，旧站仍按仓库根目录的 docs/contributing.md 维护。用户已选择先独立预览、保留当前主站。

## 接手步骤

```bash
git clone --branch codex/association-os-handoff https://github.com/rml4791lol-lang/csust-maker-hub.git
cd csust-maker-hub
git switch -c feat/your-task
cd apps/association-os
pnpm install --frozen-lockfile
pnpm dev --hostname 127.0.0.1 --port 3100
```

clone 命令在交接分支上传后可用。若仓库网页暂时看不到该分支，可以先用交接源码包本地运行。

1. 先读本应用 README.md、本文件及部署说明；确认任务涉及旧站还是新版。
2. 每人新建功能分支，限定改动范围；新版主要在 apps/association-os/。
3. 修改后在应用目录运行 lint、test、build；UI 另验桌面、手机宽度、交互和控制台。
4. 推送个人分支，向 codex/association-os-handoff 发 PR，评审后合入新版协作分支。切主站单独安排。
5. 公开仓库可直接 clone；向原仓库推送需要站长在 GitHub Settings → Collaborators 授权。无写权限可用 Fork + PR。

## 代码地图

| 路径 | 职责 |
|---|---|
| src/app/ | 页面、登录页、管理后台 |
| src/app/api/ | 公开查询、认证、后台 CRUD、足迹及附件 |
| src/components/hero*.tsx | Hero 构图、旋转、光效及视差 |
| src/components/geometry-mark.tsx | 内页几何视觉 |
| src/app/globals.css | 字号、色彩、间距和全局样式 |
| src/lib/db.ts / migrate.ts | SQLite 初始化与迁移 |
| src/lib/admin-schema.ts | 表单和字段定义 |
| src/lib/admin-auth.ts | 管理员校验与签名 cookie |
| src/lib/footprint-service.ts / uploads.ts | 足迹及附件 |
| tests/ | 迁移、API、认证及数据回归测试 |

## 已确认设计

冷色未来科技风、深色克制。保留偏左 Hero 金属结、几何线框、持续旋转、鼠标光效和视差，几何语言可延伸内页。不得把 Hero 再改成静态居中；不要添加装饰性编号、英文眉题或小字脚注。必要辅助信息至少 14px，正文 16px，支持减少动态效果。

用户已接受 Hero 动效恢复；全站和生产验收尚未完成。构建通过不能代替视觉验收。

## 当前能力与缺口

- 后台维护成员、内容摘要、项目、竞赛、活动、成果、足迹七类数据，含基础审计。
- 公开足迹自填姓名、提交即公开；没有已核验成员身份、个人编辑权或完整审核链。
- 内容库暂无正文、资源链接、封面和附件编辑；公开内容 API 没有按 status 隐藏草稿。
- 部门没有后台维护入口；项目以名称作主键，关系多用自由文本，日期常用 MM-DD。
- SQLite 可设置独立目录；附件仍在应用工作目录的 data/uploads/，备份必须同时覆盖。
- 生产反代、共享限流、会话主动撤销、备份恢复演练与旧站迁移尚未验证。

## 旧站衔接

GitHub main 和 an520.xin 是 Astro + JSON 内容 + 独立后台。服务器上的 content/、发布状态、投稿、档案、审核和指标是独立数据，不会随新版代码自动转换成 SQLite。

正式切换前应补齐新版长文、资源与审核数据结构，再做有备份、可重复验证的映射迁移，核对条数、状态、作者、链接和附件。不能把旧站 JSON 覆盖成示例数据，也不能把新应用登录凭据当作旧站账号。
