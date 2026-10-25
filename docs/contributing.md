# 贡献指南：人和 agent 都能改这个站

本站是长理创客的内部知识库。这份文档让**任何人**（以及他们带的 **任何 agent**）拿到仓库就知道怎么改内容、怎么提功能、什么不能碰。

## 0. 五分钟跑起来（人）

前置：Node 22+、pnpm（`corepack enable pnpm`）、仓库访问权（私有仓库，找站长加 collaborator）。

```bash
git clone https://github.com/rml4791lol-lang/csust-maker-hub.git
cd csust-maker-hub && pnpm install
pnpm dev        # http://localhost:4321
pnpm test       # 内容校验（warn 不阻塞，error 阻塞）
pnpm build && pnpm test:smoke   # 构建产物烟雾检查
pnpm admin      # 本地后台 http://127.0.0.1:3210（admin/admin123）
```

## 1. 必读顺序（agent 和人都读这个）

1. 根目录 `AGENTS.md` —— 项目约定 + 设计约束（白底黑字单蓝、列表优先、字号 token、全站 noindex）。**违反设计约束 = 做错**。
2. `README.md` —— 命令、部署、后台架构。
3. `docs/specs/0001-internal-knowledge-site-v2.md` —— 站是什么、成功标准、范围边界。
4. `content/items.json` 的 `g01` —— **内容标准样板**：场景带数字、路径可照做、提示词带硬约束、3 条真坑、使用记录。判断标准：**一个没做过的人照着做完，能产出东西**。
5. `docs/agents/issue-tracker.md` —— 工单怎么开、怎么关（GitHub Issues）。

## 2. 改内容的两条路径（agent 重点看）

**内容真源有两份，改哪个取决于你改什么：**

| 你要改的 | 走哪条 | 为什么 |
|---|---|---|
| 内容条目（攻略/指令/模板的文字） | **线上 agent API**（下表） | 线上后台和 agent API 直接写**服务器上**的 `content/items.json`，那是运营真源 |
| 页面 / 组件 / 新功能 / 修 bug | **git 仓库**（issue → 分支 → main） | 代码走版本控制 |

⚠️ git 里改 `content/items.json` 前，先确认服务器版没有更新的运营改动（找站长拉一次服务器 `content/` 对齐），否则互相覆盖。

### 线上 agent API（Bearer token）

向站长要 `AGENT_TOKEN`（存服务器 `~/csust-maker-hub/.env.admin`，**绝不入仓库**）。所有请求带 `Authorization: Bearer <token>`，地址前缀 `https://an520.xin/admin/api`：

| 端点 | 用途 |
|---|---|
| `GET /items` / `GET /items/:id` | 读全部 / 单条 |
| `PUT /items/:id` | 新建或更新（JSON body，字段结构用 `GET /scaffold?type=guide` 拿骨架） |
| `DELETE /items/:id` | 删除 |
| `POST /state` | 改发布状态 `{"id":"g01","state":"published"}`，发布前先过三条合规红线 |
| `POST /review` | `{"id":"..."}` 完成复核 |
| `GET /metrics` | 浏览量 / 有用没用 / 照做数聚合 |
| `GET /scaffold?type=<类型>` | 十类内容骨架 + 写作标准提示 |
| `GET/PUT /flags` | 功能开关（首页区块 / 数据页面板 / 工具导航）。PUT `{"key":"home.cta","enabled":false}`，**重新构建后生效** |
| `GET/PUT /tools` | 工具站与 API 目录（PUT 整表替换，字段校验见接口报错提示），**重新构建后生效** |

写完内容默认 `publishState: "draft"`，让人在后台确认后发布（后台：https://an520.xin/admin/）。

### 内容硬规则

- 五段结构照 g01（scene / path / prompt / pitfalls / usage），没有实测数据就写 `[待补充]`，**不编数字**。
- 学习类内容区分「要解释」和「要代写」，默认教前者（见 `docs/调研-真正有用的入门与vibecoding`）。
- 实测类必须带计时 / 计数 / 价格，不接受「感觉快了」。
- 合规红线：不涉政治宗教民族敏感；不发他人隐私与未公开数据；不转载未授权付费内容与破解教程。
- 不做：搜索框、提需求 / 服务台、账号注册、视频托管、营销卡片、轮播、渐变、紫色。

## 3. 提功能 / 修 bug（git 流程）

1. 开 issue（用 `docs/agents/` 里的 label 约定：`ready-for-agent` 等五档）。
2. 分支上做，验收标准写在 issue 里；测试跟着功能走（看 `tests/` 现有接缝）。
3. 合入 main 并 push，然后按下一节上线。
4. 内容站的 backlog 和调研结论见 `docs/调研-知识库运营-*.md`、`docs/调研-真正有用的入门与vibecoding-*.md`，提功能前先看，避免重造。

## 4. 连接服务器与上线

站点是纯静态 + 一个小后台服务，都跑在一台腾讯云香港服务器上。

### 拿权限

把你的 SSH **公钥**（`cat ~/.ssh/id_ed25519.pub`）发给站长，站长加进服务器 `ubuntu` 用户的 `authorized_keys`。agent 若要 SSH，让它用你本机的 key（agent 不要另管密钥）。

### 服务器布局（只用这些，别的不碰）

| 路径 / 单元 | 是什么 |
|---|---|
| `~/csust-maker-hub/` | 源码快照（无 `.git`，从本机 rsync 同步） |
| `/var/www/csust-maker/` | 站点构建产物（Caddy 直接伺服） |
| `~/csust-maker-hub/.env.admin` | 后台密钥（AGENT_TOKEN / ADMIN_USERS / DEPLOY_TARGET），**绝不入 git、rsync 必须排除** |
| `~/csust-maker-hub/metrics.json` | 运行时浏览/反馈数据，**rsync 必须排除** |
| systemd：`csust-admin.service` | 后台常驻（127.0.0.1:3210） |
| systemd：`csust-build-daily.{service,timer}` | 每天 03:30 构建 + 部署 + 运营简报 |
| Caddy：`/etc/caddy/Caddyfile` 里 `an520.xin` 块的 csust 段 | 路由（`/admin/` 反代 3210） |

### 连接

```bash
ssh -i ~/.ssh/<你的私钥> ubuntu@43.161.198.195
```

### 上线（改完 main 之后）

```bash
# 1. 同步源码到服务器（注意排除项，漏了 .env.admin 会被 --delete 删掉导致后台挂掉）
rsync -az --delete --exclude node_modules --exclude dist --exclude .astro \
  --exclude .git --exclude screenshots --exclude .env.admin --exclude metrics.json \
  -e "ssh -i ~/.ssh/<你的私钥>" \
  ./ ubuntu@43.161.198.195:~/csust-maker-hub/

# 2. 同步站点产物（上线即刻生效）
rsync -az --delete --chmod=D755,F644 --exclude '.DS_Store' \
  -e "ssh -i ~/.ssh/<你的私钥>" \
  dist/ ubuntu@43.161.198.195:/var/www/csust-maker/

# 3. 改了 scripts/admin-server.ts 或内容结构时，重启后台
ssh -i ~/.ssh/<你的私钥> ubuntu@43.161.198.195 'sudo systemctl restart csust-admin'
```

### 常用运维（在服务器上）

```bash
systemctl status csust-admin                 # 后台状态
sudo journalctl -u csust-admin -n 50         # 后台日志（发布推送 dry-run 也在这看）
sudo systemctl start csust-build-daily.service   # 手工触发 构建+部署+简报
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy  # 改路由后
```

### 服务器红线（违反就是事故）

1. **不动其他站点**：`/var/www/an520-*`、Caddyfile 里其他路由块、其他 systemd 单元，一律不碰。
2. 改 Caddyfile 前先备份（`sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%Y%m%d)-<事由>`），validate 通过才 reload。
3. 密钥只活在服务器 `.env.admin`，不入 git、不进聊天记录。
4. 不 force push main。

## 5. 站长的责任边界

- 加 collaborator、发 AGENT_TOKEN、加服务器公钥、改后台密码（服务器 `.env.admin` 的 `ADMIN_USERS`）。
- 定期把服务器的运营数据拉回本机提交（分歧防护）：`bash scripts/sync-from-server.sh`。
- 审核内容发布（后台点发布，或授权 agent 代审）。
