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
rsync -az --delete --exclude '.DS_Store' \
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
