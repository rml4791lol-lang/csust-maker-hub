# 长理 AI 创客 · 协会展示与成员能力档案站

长沙理工大学 AI 创客协会（云塘校区 · 科创港）的展示站：活动与成果、成员能力档案、成果提交。
静态站，Astro 5 构建，部署在 `an520.xin`；线上另有最小后台（`/admin`，接口 `/admin/api/*`，agent 用 Bearer token）。

## 项目约定

- **信息架构只保留两条主线**：展示活动与成果、收集并分析成员能力。页面在 `src/pages/`：
  `index`（首页）/ `achievements`（活动与成果）/ `members`（成员能力）/ `members/[id]`（个人档案）/ `contribute`（提交记录）/ `404`。
  已下线：内容库、工具站、资源、数据看板、关于页（见 `docs/2026-10-28-精简改版.md`），不要在没有明确需求时加回来。
- **业务数据在 `content/`**：`activities.json`（协会活动记录，含 `public/photos/` 现场照片）、`submissions.json`（成员成果记录，`status` 控制展示）、`profiles.json`（成员能力档案，**自动生成**）。
  `items.json` / `flags.json` / `tools.json` 是历史数据，仅作回填与后台兼容保留。
- **成员名单在 `src/data/members.ts`**，协会信息/导航/部门职责/运行机制/首屏照片在 `src/data/site.ts`；现场照片在 `public/photos/`（压缩后的 jpg，页面懒加载）。
- **AI 感装饰图在 `public/decor/`**：程序化生成（`scripts/generate-decor.py`），只做低对比点缀，必须 `pointer-events:none` 且尊重 reduced-motion，不能盖过正文。
  已用于：首页首屏（轨道/极光/波纹）、全部页头与 CTA（神经网络）、首页关于协会与成员能力区（轨道/神经）、活动成果页与投稿页（轨道）、页脚（波纹）。
- **AI 能力分析自动化**：`src/data/analyze.ts`（规则分析 + 可选 LLM）；`pnpm analyze` 重算档案；
  后台审核发布投稿后自动重算；接口 `POST /api/analyze`。服务器配 `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` 后自动升级 LLM 分析。
- **发布状态在 `src/data/publish-state.json`**（后台写入），审核记录在 `src/data/review-log.json`。
- 校验：`pnpm test`；构建烟雾：`pnpm test:smoke`（会校验冗余页面不应再产出）。
- **不要提交** `node_modules/`、`dist/`、`.astro/`（见 `.gitignore`）。
- **构建**：`pnpm build`（产物 `dist/`）；**本地预览**：`pnpm dev` → http://localhost:4321
- **部署**：rsync `dist/` 到服务器 `/var/www/csust-maker`，详见 `README.md`。
- 静态页不依赖后端也能看；后台只服务投稿审核与 AI 汇总重算。

## 设计约束（2026-10 视觉改版 + 10-28 精简后的新规范）

- **暗色科技风**：近黑底（`#08090a`），单一靛蓝强调色（主 `#5e6ad2` / 亮 `#8fa4ff`）；允许低饱和光晕、极细网格与噪点，不做整屏高饱和色块。
- 列表与表格优先，不做营销卡片和轮播（首屏「科创港照片翻页」是内容照片轮播，例外）；卡片只用在一组并列项或数据对象上。
- 字体：Inter（拉丁/数字）+ PingFang SC（中文）；小标签用等宽字（大写 + 宽字距）；数字统一 `tabular-nums`。
- 字号/圆角用 token（`--text-*`、`--radius-*`），不写死；正文行高 1.7~1.85。
- 动效：入场级联、滚动入场、数字滚动、悬停微交互；必须尊重 `prefers-reduced-motion`，且无 JS 时内容完整可见。
- 简洁优先：4 个导航入口；不做全局搜索（页面太少，搜索是纯负担）。首页不堆解释文字、不展示成员人数（人数会变）；首屏用科创港照片轮播。
- 字体下限（2026-10-28 再放大）：正文 16px、描述 16px、标签/元信息 15px，**任何页面不出现小于 14px（五号）的文字**；导航/页脚 15px。
- 收录：`site.publicIndex` 默认 `false`；个人档案页始终 noindex；换真实数据后可开启全站收录。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
