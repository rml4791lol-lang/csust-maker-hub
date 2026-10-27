# 工作区上下文：长理创客内部知识站（2026-10-26）

> 本文档是**活的状态快照**：任何 agent / 新会话 / 协作者接手前先读完。上手操作见 `docs/contributing.md`，领域词汇见根 `GLOSSARY.md`，设计约束见根 `AGENTS.md`。

## 站点现状（全部已上线并验证）

- **地址**：https://an520.xin · 后台 https://an520.xin/admin/（账号见服务器 `~/csust-maker-hub/.env.admin` 的 `ADMIN_USERS`；若还是默认口令请立刻改）
- **内容**：32 条（content/items.json），攻略 g01-g14 + skill ×3 + 模板/外链/培训/项目/竞赛/活动/课程/视频
- **内容线**：工具实测与省钱（g04-g08，收录自 ai.an520.xin）· 入门与 vibe coding 全生命周期（g09-g14：第一次写代码 → 验收 → git 回滚 → 部署上线 → 学习姿势 → 安全红线）
- **功能开关**：content/flags.json，9 个开关控制首页六区块 + 数据页两面板 + 工具导航。后台「功能开关」区点切换 → 点重新构建生效（静态站构建时应用）。受众标注：全员/核心/四部门——静态站无登录，受众是管理侧标注
- **工具/API 目录**：content/tools.json，/tools 页三分组展示（含状态与受众）
- **数据回路**：详情页浏览打点 + 有用/没用/照做三态反馈 → 服务器 metrics.json（gitignore）→ 后台汇总 + 数据页实时排行
- **保鲜机制**：90 天复核（REVIEW_DAYS 可配）+ 后台待复核清单 + /api/review
- **推送**：发布即推 IM 卡片（飞书签名/企微双通道）+ 每天 03:30 运营简报——**当前 dry-run，等站长给 webhook**（scripts/im-push.ts）
- **基础设施**：404 页（Caddy handle_errors）· csust-admin.service · csust-build-daily.timer · sync-from-server.sh（双真源同步）

## 架构事实（改代码前必读）

1. **双真源**：内容条目的运营真源在**服务器** `~/csust-maker-hub/content/`（后台与 agent API 写它）；代码真源在 **git main**。本机 `bash scripts/sync-from-server.sh` 拉回，rsync 上线前必须先拉，否则互相覆盖
2. **push ≠ 上线**：上线 = 本机 rsync（contributing.md 第 4 节有完整命令与排除清单——漏排除 `.env.admin` / `metrics.json` 会出事故，已发生过一次）
3. **验证链**：`pnpm test`（23 个）→ `pnpm build`（37 页）→ `pnpm test:smoke`。**后台 UI 改动必须真的 curl 一次页面**——曾有 import 缺失导致线上崩溃循环而六轮本地验证全绿
4. **服务器红线**：同机还有十几个别的站点（/var/www/an520-*、Caddy 其他块），只碰 csust 相关；改 Caddyfile 前备份、validate 后 reload
5. **多 agent token**：服务器 `.env.admin` 的 `AGENT_TOKENS="token:名字,…"`，日志按 `agent:名字` 留痕；`AGENT_TOKEN` 是站长本人的

## 工单与协作

- GitHub：rml4791lol-lang/csust-maker-hub。#9-#14 已关闭（评论带证据），#1 是总 spec（等运营成功标准再关）
- 协作入口：docs/contributing.md（人 + agent 双轨）· 工单技能配置在 docs/agents/（mattpocock 全套）· 领域词表 GLOSSARY.md
- 协作者：loong333、Qiu-Py（collaborator 邀请已发待接受；agent token 已按人签发）

## 下一步（按优先级）

1. **#10 webhook**：站长给飞书群机器人（URL + 签名 secret）或企微机器人地址 → 写进服务器 .env.admin → restart → dry-run 变实发
2. **真实数据替换（P3）**：成员/项目还是占位名（林知/陈屿…），等真实名单
3. **spec #1 关闭条件**：上线一个月验证成功标准（3 个非技术成员打开过；1 人照做产出——看 metrics 的 confirmed；有人催更）
4. 可能的下一步：GitHub Actions 自动部署（push main 即上线，需站长配 SSH secret）· 反馈周报推管理员 · 内容条目的使用记录回填（confirmed 数据攒起来后）
