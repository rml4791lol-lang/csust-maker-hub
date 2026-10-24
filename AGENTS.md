# 长理创客 · 技术分享网站

创客空间的技术分享与服务门户。静态站，Astro 5 + Tailwind 4，部署在 `an520.xin`。

## 项目约定

- **所有内容在 `src/data/`**：`site.ts`（站名/导航/首页）、`members.ts`（成员）、`items.ts`（项目/竞赛/活动/课程）、`services.ts`（服务与需求）。改内容不碰页面。
- **页面在 `src/pages/`**，布局与导航在 `src/layouts/`、`src/components/`，设计系统在 `src/styles/global.css`。
- **不要提交** `node_modules/`、`dist/`、`.astro/`（见 `.gitignore`）。
- **构建**：`pnpm build`，产物在 `dist/`。
- **本地预览**：`pnpm dev` → http://localhost:4321
- **部署**：rsync `dist/` 到服务器 `/var/www/csust-maker`，详见 `README.md`（含回滚步骤）。
- 线上是纯静态站，没有后端；表单目前走 `mailto:`，不要假设有 API。

## 设计约束

- 深色工程感 + 橙色信号色（`#e0632f`），衬线中文标题 + 无衬线正文。
- 动效用渐进增强：`.js` 类才启用滚动浮现，无 JS 时内容必须全部可见。
- 中文排版优先：标题不强行断行，字号用 `clamp()`。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
