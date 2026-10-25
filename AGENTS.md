# 长理创客 · 技术分享网站

创客空间的技术分享与服务门户。静态站，Astro 5 + Tailwind 4，部署在 `an520.xin`。

## 项目约定

- **所有内容在 `src/data/`**：`site.ts`（站名/导航/首页）、`members.ts`（成员）、`items.ts`（五类内容：攻略 guide / 技能指令 skill / 模板 template / 外部项目 link / 培训 training）。改内容不碰页面。
- **发布状态在 `publish-state.json`**（后台写入），审核记录在 `review-log.json`。校验：`pnpm test`，构建烟雾：`pnpm test:smoke`。
- **页面在 `src/pages/`**，布局与导航在 `src/layouts/`、`src/components/`，设计系统在 `src/styles/global.css`。
- **不要提交** `node_modules/`、`dist/`、`.astro/`（见 `.gitignore`）。
- **构建**：`pnpm build`，产物在 `dist/`。
- **本地预览**：`pnpm dev` → http://localhost:4321
- **部署**：rsync `dist/` 到服务器 `/var/www/csust-maker`，详见 `README.md`（含回滚步骤）。
- 线上是纯静态站，没有后端；表单目前走 `mailto:`，不要假设有 API。

## 设计约束

- 浅色工具风：白底、黑字、单一蓝色点缀（`#1a56db`），不做渐变、不做紫色。
- 列表与表格优先，不做营销卡片和轮播。
- 字体：Inter（拉丁/数字）+ PingFang SC（中文）；数字统一 `tabular-nums`。
- 字号用 token（`--text-*`），不写死；行高用 `--leading-*`。
- 不做滚动隐藏：内容始终可见（避免快速滚动出现空白）。
- 全站 `noindex`，内部使用。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
