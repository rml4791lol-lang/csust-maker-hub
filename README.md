# 长理创客 · 技术分享网站

创客空间的技术分享与服务门户。静态站，Astro 构建，部署在 `an520.xin`。

- 线上地址：https://an520.xin
- 服务器：`ubuntu@43.161.198.195`（香港 hk-hermes，Caddy）
- 站点目录：`/var/www/csust-maker`

---

## 页面

| 路径 | 内容 |
|---|---|
| `/` | 首页：定位、数据、三入口、动态、内容预览、服务、成员 |
| `/library` | 内容库：项目 / 竞赛 / 活动 / 课程，类型筛选 + 搜索 |
| `/library/<id>` | 条目详情：信息、大纲/复盘、参与人 |
| `/members` | 成员：部门筛选 + 搜索，含技能和参与项目 |
| `/services` | 服务台：服务目录、需求登记表单、需求看板、流程 |
| `/about` | 关于：四类工作、部门、数字、联系 |

---

## 改内容

所有内容都在 `src/data/`，不需要碰页面：

- `site.ts` — 站名、导航、三入口、首页数字
- `members.ts` — 成员（姓名 / 部门 / 年级 / 技能 / 参与项目）
- `items.ts` — 内容库（项目 / 竞赛 / 活动 / 课程）
- `services.ts` — 服务目录 + 需求看板

改完重新构建 + 部署即可。

---

## 本地开发

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # 产物在 dist/
```

## 部署

```bash
pnpm build
rsync -az --delete --chmod=D755,F644 --exclude '.DS_Store' \
  -e "ssh -i ~/.ssh/tencent_hk_hermes.pem" \
  dist/ ubuntu@43.161.198.195:/var/www/csust-maker/
```

Caddy 配置里，`an520.xin` 主站的落点是：

```caddyfile
root * /var/www/csust-maker
handle {
    try_files {path} /index.html
    file_server
}
```

改了配置后：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

### 线上后台与定时构建（2026-10-25 接入）

- 源码在服务器 `~/csust-maker-hub`（rsync 快照，无 `.git`）。从本机更新代码时**必须排除 `.env.admin`**（含 AGENT_TOKEN，rsync `--delete` 会把它删掉）：

  ```bash
  rsync -az --delete --exclude node_modules --exclude dist --exclude .astro \
    --exclude .git --exclude screenshots --exclude .env.admin --exclude metrics.json \
    -e "ssh -i ~/.ssh/tencent_hk_hermes.pem" \
    ./ ubuntu@43.161.198.195:~/csust-maker-hub/
  ```

- `csust-admin.service`：后台常驻，监听 `127.0.0.1:3210`；环境文件 `~/csust-maker-hub/.env.admin`（AGENT_TOKEN / DEPLOY_TARGET / ADMIN_PORT）。
- Caddy 路由：`an520.xin/admin/` 剥前缀反代 3210（备份：`Caddyfile.bak-20261025-csust-admin`）。agent 调用走 `https://an520.xin/admin/api/*`，带 `Authorization: Bearer $AGENT_TOKEN`。
- `csust-build-daily.timer`：每天 03:30 在服务器上 `pnpm build` + rsync 到 `/var/www/csust-maker/`，让过期标注和内容更新自动生效。
- 每日运营简报（issue #14）：构建成功后向 IM 推一条简报（新增反馈 / 浏览 Top3 / 即将到期；无新动态也推一条极简说明），由 `scripts/daily-brief.ts` 实现，推送通道复用 #10（`FEISHU_WEBHOOK`/`FEISHU_SECRET` 或 `WECOM_WEBHOOK`，见下文「IM 群机器人推送」）。服务器侧需在 `/etc/systemd/system/csust-build-daily.service` 的 `[Service]` 段 `ExecStart` 之后追加一行：

  ```ini
  ExecStartPost=/bin/bash -lc 'cd /home/ubuntu/csust-maker-hub && pnpm tsx scripts/daily-brief.ts'
  ```

  然后 `sudo systemctl daemon-reload`。注意：该 service 需要能读到推送环境变量——若其 `[Service]` 段没有 `EnvironmentFile=/home/ubuntu/csust-maker-hub/.env.admin`，需要加上（或用 `Environment=` 写入）。构建失败（`ExecStart` 非零）时 ExecStartPost 不会执行，简报不发。手工触发验证：`sudo systemctl start csust-build-daily.service`。
- 注意：后台写入的是**服务器上**的 `content/items.json`，本机仓库不会自动同步回来；定期把服务器的 `content/`、`src/data/` 拉回本机提交。### 浏览量与反馈（2026-10-25 接入）

- 运行时指标存在服务器上的 `metrics.json`（仓库根目录，**已 gitignore**，rsync 同步源码时必须 `--exclude metrics.json`，否则会覆盖线上计数）。
- 公开端点（无需登录，挂在 `an520.xin/admin/api/*` 下）：
  - `POST /admin/api/track`：`{"id":"g04"}`，详情页每次访问 sendBeacon 一次，id 校验后才计数；不存 IP、不存指纹。
  - `POST /admin/api/feedback`：`{"item":"g04","vote":"useful","note":"…"}`，note 截断 200 字，日志上限 500 条。
  - `GET /admin/api/metrics`：聚合 `{total, views, feedback, updatedAt}`，数据页「浏览量排行」实时读它。
- 详情页侧栏的「浏览」数字是**构建时**烘进去的（每天 03:30 定时构建刷新）；数据页的排行是实时的。

### IM 群机器人推送（2026-10-25 接入）

- 条目状态改为 `published` 时（后台页面或 `/api/state`），异步向群机器人推送卡片：标题 / 作者 / 一句话摘要 / 详情页链接（`https://an520.xin/library/<id>`）。推送失败只记日志，不影响状态流转。
- 环境变量写在服务器 `.env.admin`（**值不入仓库**），配其一即可：
  - `FEISHU_WEBHOOK`：飞书自定义机器人 webhook 地址；`FEISHU_SECRET`：签名密钥。签名按飞书官方规则：把 `timestamp+"\n"+secret` 当作 HmacSHA256 的 key、内容为空串，结果 base64，随 `timestamp`/`sign` 字段一起 POST。
  - `WECOM_WEBHOOK`：企业微信群机器人 webhook 地址，直接 POST JSON（markdown 卡片）。
- 都不配置则 dry-run：不报错，日志打印本应发送的卡片；后台页面顶部显示「IM 推送：未配置（dry-run）」，配置后显示「IM 推送：已启用」。

### 90 天复核（2026-10-25 接入）

- 已发布条目按 review-log 里最近一次「发布 / 完成复核」时间计时，超过阈值未复核的会在后台顶部列入「待复核」清单（显示条数、id、标题、最近复核日期）。
- 清单里每条有「完成复核」按钮：`POST /api/review` body `{"id":"…"}`（后台登录态或 agent Bearer token 均可），写入 review-log（`type:"review"`，带操作人），页面刷新后移出清单。
- 阈值用环境变量 `REVIEW_DAYS`（单位：天，写在服务器 `.env.admin`），不设置则用代码默认值。

### 回滚

本次上线前备份：`/etc/caddy/Caddyfile.bak-20261024-csust-maker`

恢复成原来的维护页：

```bash
sudo sed -i 's|root \* /var/www/csust-maker|root * /var/www/an520-maintenance/main|' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

注意：`an520.xin` 上还挂着 `/tryon`、`/buy`、`/ai`、`/info-tech`、`/channels`、`/post-tension-edu`、`/xiexiu` 等既有服务，改主站 `root` 不影响这些 `handle`，但动 Caddyfile 前先备份。

---

## 待接入

- [ ] 内容替换：现有数据是演示用的占位，等真实成员和项目信息
- [ ] 需求表单：目前提交走 `mailto:`，建议换成飞书表单 / 多维表格
- [ ] 数据源：成员和内容改为从飞书多维表格同步（现在是本地 TS 文件）
- [ ] 404 页面：目前未知路径会回落到首页
- [ ] 品牌名确认：域名此前是「安芯跃动」，现站名为「长理创客」
