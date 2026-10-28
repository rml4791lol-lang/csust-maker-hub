# 长理 AI 创客 · 协会展示与成员能力档案站

长沙理工大学 AI 创客协会（云塘校区 · 科创港）的展示站：活动与成果、成员能力档案、成果提交。
静态站，Astro 5 构建，部署在 `an520.xin`；线上另有最小后台（`/admin`，接口 `/admin/api/*`，agent 用 Bearer token）。

## 项目约定

- **信息架构只保留两条主线**：展示活动与成果、收集并分析成员能力。页面在 `src/pages/`：
  `index`（首页）/ `achievements`（活动与成果）/ `members`（成员能力）/ `members/[id]`（个人档案）/ `contribute`（提交记录）/ `404`。
  已下线：内容库、工具站、资源、数据看板、关于页（见 `docs/2026-10-28-精简改版.md`），不要在没有明确需求时加回来。
- **业务数据在 `content/`**：`activities.json`（协会活动记录，含 `public/photos/` 现场照片）、`submissions.json`（成员成果记录，`status` 控制展示）、`uploads.json`（成员上传的现场照片记录，审核状态控制展示）、`members.json`（成员档案数据，初始演示；管理端可同步真实账号覆盖）、`profiles.json`（成员能力档案，**自动生成**）。
  `items.json` / `flags.json` / `tools.json` 是历史数据，仅作回填与后台兼容保留。
- **成员名单在 `src/data/members.ts`**，协会信息/导航/部门职责/运行机制/首屏照片在 `src/data/site.ts`；现场照片在 `public/photos/`（压缩后的 jpg，页面懒加载）。
- **AI 感装饰图在 `public/decor/`**：程序化生成（`scripts/generate-decor.py`），只做低对比点缀，必须 `pointer-events:none` 且尊重 reduced-motion，不能盖过正文。
  已用于：首页首屏（轨道/极光/波纹）、全部页头与 CTA（神经网络）、首页关于协会与成员能力区（轨道/神经）、活动成果页与投稿页（轨道）、页脚（波纹）。
- **AI 能力分析自动化**：`src/data/analyze.ts`（规则分析 + 可选 LLM）；`pnpm analyze` 重算档案；
  后台审核发布投稿后自动重算；接口 `POST /api/analyze`。服务器配 `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` 后自动升级 LLM 分析。
- **现场照片上传**：所有登录成员可传；部长及以上直接展示、普通成员需管理员审核；文件在 `public/photos/uploads/`，相册页 `/gallery`，管理端 `/manage` 照片审核。
- **成员档案同步**：`content/members.json` 为数据源；超级管理员在 `/manage` 点「同步成员档案」把审核通过的账号写入并重算档案，**重新构建后生效**。
- **成员账号（实名 v2）**：`src/data/auth.ts` 负责注册校验（邮箱/手机号/真实姓名/身份/密码）、密码哈希、会话签名；账号数据存服务器本地 `DATA_DIR`（默认 `~/.csust-maker-data`，不入仓库）；管理员分超级管理员/审核管理员，独立管理端 `/manage`；超级管理员固定为技术部部长（负责人），首次部署用 env `SUPER_ADMIN_EMAIL/PASSWORD/NAME/PHONE` 初始化（默认身份 技术部 · 技术部部长）；投稿必须登录。
- **分享卡片在 `public/share/`**：`home.jpg` + 每位成员 `member-mXX.jpg`，由 `scripts/generate-share-cards.py` 生成；页面通过 `Base` 的 `shareImage` 参数输出 `og:image`。
- **发布状态在 `src/data/publish-state.json`**（后台写入），审核记录在 `src/data/review-log.json`。
- 校验：`pnpm test`；构建烟雾：`pnpm test:smoke`（会校验冗余页面不应再产出）。
- **不要提交** `node_modules/`、`dist/`、`.astro/`（见 `.gitignore`）。
- **构建**：`pnpm build`（产物 `dist/`）；**本地预览**：`pnpm dev` → http://localhost:4321
- **部署**：rsync `dist/` 到服务器 `/var/www/csust-maker`，详见 `README.md`。
- 静态页不依赖后端也能看；后台只服务投稿审核与 AI 汇总重算。

## 设计约束（2026-10-28 合并 association-os 前端风格后的新规范）

- **工作台暗色风**：冷 navy 底（`#090d14`），面板 `#111925/#172230/#1e2c3d`；蓝色主强调 `#5797ff` + 青色次强调 `#50d6e8`；8px 圆角、1px 描边、顶部受光 + 双层投影。
- **布局**：左侧 240px 固定侧边栏（5 个主导航 + 管理端/登录）+ 64px 顶部粘性工具栏 + 最大 1440px 内容区；≤1024px 收起侧栏改顶部抽屉。
- **首屏**：冷蓝渐变 stage + 3D 线框场景（three.js，桌面且允许动效时启用；移动端与 reduced-motion 用静态几何线框兜底）+ 玻璃「最近成果」面板；数据概览用四列衬线大数字；**不展示成员人数**。
- **字体**：标题/正文 Noto Sans SC；叙述正文 Noto Serif SC；元数据 JetBrains Mono；数字 Times + `tabular-nums`。字号/圆角一律用 token。
- **动效**：reveal 入场、数字滚动、悬停微交互；必须尊重 `prefers-reduced-motion`，且无 JS 时内容完整可见。
- **简洁优先**：5 个导航入口；不做全局搜索/命令面板（页面太少，搜索是纯负担，刻意没合并对方这项）。首页不堆解释文字。
- **字体下限**：正文 16px、描述 16px、标签/元信息 15px，**任何页面不出现小于 14px（五号）的文字**；导航 15px。
- **设计来源**：关联 association-os（技术部另一位成员的 Next.js 原型）的视觉语言；合并记录见 `docs/2026-10-28-设计合并.md`；其源码在 `.dsh-preview/`（不提交）。
- 收录：`site.publicIndex` 默认 `false`；个人档案页始终 noindex；换真实数据后可开启全站收录。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
