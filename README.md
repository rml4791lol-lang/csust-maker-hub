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
- 注意：后台写入的是**服务器上**的 `content/items.json`，本机仓库不会自动同步回来；定期把服务器的 `content/`、`src/data/` 拉回本机提交。

### 浏览量与反馈（2026-10-25 接入）

- 运行时指标存在服务器上的 `metrics.json`（仓库根目录，**已 gitignore**，rsync 同步源码时必须 `--exclude metrics.json`，否则会覆盖线上计数）。
- 公开端点（无需登录，挂在 `an520.xin/admin/api/*` 下）：
  - `POST /admin/api/track`：`{"id":"g04"}`，详情页每次访问 sendBeacon 一次，id 校验后才计数；不存 IP、不存指纹。
  - `POST /admin/api/feedback`：`{"item":"g04","vote":"useful","note":"…"}`，note 截断 200 字，日志上限 500 条。
  - `GET /admin/api/metrics`：聚合 `{total, views, feedback, updatedAt}`，数据页「浏览量排行」实时读它。
- 详情页侧栏的「浏览」数字是**构建时**烘进去的（每天 03:30 定时构建刷新）；数据页的排行是实时的。

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
