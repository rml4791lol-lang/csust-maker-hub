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

交接分支为 `codex/association-os-handoff`。需要仓库读取权限；共同开发者应使用自己的 GitHub 账号与功能分支。

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
| src/lib/admin-schema.ts | 表单字段、数值与来源链接校验 |
| src/lib/content-modules.ts / public-records.ts | 模块路由、实体名称、公共字段投影与可见性 |
| src/components/record-detail.tsx / record-editor.tsx | 七模块详情、录入与编辑共享布局 |
| src/lib/admin-auth.ts | 管理员校验与签名 cookie |
| src/lib/footprint-service.ts / uploads.ts | 足迹及附件 |
| tests/ | 迁移、API、认证及数据回归测试 |

## 已确认设计

冷色未来科技风、深色克制。保留偏左 Hero 金属结、几何线框、持续旋转、鼠标光效和视差，几何语言可延伸内页。不得把 Hero 再改成静态居中；不要添加装饰性编号、英文眉题或小字脚注。必要辅助信息至少 14px，正文 16px，支持减少动态效果。

用户要求提升 Hero 金属质感并扩展二三级页面。本轮实际视觉总监批准官网与发布中心设计方向；成品图像审查因分析工具超时未完成。普通子代理逐图复核已关闭发现的三个问题，但不能替代实际员工或用户最终验收。详见 [本轮验证和验收边界](VERIFICATION-20261028.md)。

## 当前能力与缺口

- 七模块均有公开列表、公共详情与发布中心维护页；原新增/编辑地址跳转到发布中心，保留基础审计。具体见 [官网与图文发布](OFFICIAL-COMMUNITY.md)。
- 足迹公开浏览；发布、修改和删除需要管理员登录。姓名由管理员填写、提交即公开；没有已核验成员身份、个人编辑权或完整审核链。
- 集中发布中心 `/publish` 管理七模块；社区新增 Markdown 图文、粘贴/选择图片、写作预览和草稿图片权限。公开页面不再放逐条编辑入口。详见 [官网与图文发布](OFFICIAL-COMMUNITY.md)。
- 项目迁移 v4 增加不可变稳定 ID 与说明，保留旧名称主键兼容；改名同步足迹的精确文本关联。部门仍无维护入口，关系多用自由文本，旧日期仍有 MM-DD，界面不会猜测年份。
- SQLite 与新版文章媒体在独立 DATA_DIR 和 DATA_DIR/media；旧足迹附件仍在应用工作目录 data/uploads/，备份必须同时覆盖。v5 增加 body_format 和媒体关联。
- 生产反代、共享限流、会话主动撤销、备份恢复演练与旧站迁移尚未验证。

## 旧站衔接

GitHub main 和 an520.xin 是 Astro + JSON 内容 + 独立后台。服务器上的 content/、发布状态、投稿、档案、审核和指标是独立数据，不会随新版代码自动转换成 SQLite。

正式切换前应核对新版与旧站的完整长文、资源与审核字段映射，再做有备份、可重复验证的迁移，核对条数、状态、作者、链接和附件。不能把旧站 JSON 覆盖成示例数据，也不能把新应用登录凭据当作旧站账号。
