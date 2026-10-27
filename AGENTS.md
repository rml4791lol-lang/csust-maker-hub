# 长理创客 · 技术分享网站

创客空间的技术分享与服务门户。静态站，Astro 5 + Tailwind 4，部署在 `an520.xin`。

## 项目约定

- **内容数据在 `content/`**：`items.json`（五类内容：攻略 guide / 技能指令 skill / 模板 template / 外部项目 link / 培训 training，另有历史类型保留兼容）、`flags.json`（功能开关）、`tools.json`（工具目录）。`src/data/items.ts` 等负责读入，改内容不碰页面。
- **发布状态在 `src/data/publish-state.json`**（后台写入），审核记录在 `src/data/review-log.json`。校验：`pnpm test`，构建烟雾：`pnpm test:smoke`。
- **页面在 `src/pages/`**，全站布局/导航/页脚/搜索在 `src/layouts/Base.astro`，设计系统在 `src/styles/global.css`。
- **不要提交** `node_modules/`、`dist/`、`.astro/`（见 `.gitignore`）。
- **构建**：`pnpm build`，产物在 `dist/`。
- **本地预览**：`pnpm dev` → http://localhost:4321
- **部署**：rsync `dist/` 到服务器 `/var/www/csust-maker`，详见 `README.md`（含回滚步骤）。
- 线上是静态站 + 服务器上一个最小后台（`/admin`，接口在 `/admin/api/*`，agent 用 Bearer token）；静态页不依赖后端也能看。

## 设计约束（2026-10 视觉改版后的新规范）

- **暗色科技风**：近黑底（`#08090a`），单一靛蓝强调色（主 `#5e6ad2` / 亮 `#8fa4ff`）；允许低饱和光晕、极细网格与噪点，不做整屏高饱和色块。
- 列表与表格优先，不做营销卡片和轮播；卡片只用在一组并列项或数据对象上。
- 字体：Inter（拉丁/数字）+ PingFang SC（中文）；小标签用等宽字（大写 + 宽字距）；数字统一 `tabular-nums`。
- 字号/圆角用 token（`--text-*`、`--radius-*`），不写死；正文行高 1.7~1.85。
- 动效：入场级联、滚动入场、数字滚动、悬停微交互；必须尊重 `prefers-reduced-motion`，且无 JS 时内容完整可见。
- 站内搜索：保留 ⌘K 搜索面板（只索引已发布内容）。
- 全站 `noindex`，内部使用。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
