# 协会官网、社区图文与排程参考调研

调研日期：2026-10-28（Asia/Shanghai）。研究者：普通 Codex 子代理 `/root/page_review`。状态：真实站点研究已完成；正式方案见同目录 `方案书.md`；实际Hermes Visual Director已返回文字方向Approve，会话 `20261028_181959_315a35`，完整回执见 `director-direction.md`，本研究不代替成品视觉验收。

## 结论

推荐沿用已有冷深色和 Hero 几何，改变公开网站的信息架构：公共横导航、内容优先的文章流、独立发布中心、叙事式关于页、日期主导的活动排程。本轮同类参考提供的是结构和阅读机制，不要求复制它们的白底、品牌、插画、人数或排版细节。

本轮成功浏览四组站点（Berkeley 社团、Hugging Face 社区与博客、PyCon、Luma），并进入组织介绍、真实长文和具体日历。Stanford ACM 连接失败；未把失败页面作为参考。所有页面均在独立 Chrome Playwright context 只读访问，未登录、未发帖、未订阅、未提交表单。真实截图保存在 `evidence/official-community-20261028/`，访问元数据见 `reference-manifest.json`。

**素材更新：** 方向brief提交后，Morgan提供了 `协会照片.zip` 并授权选用到网站或新增板块，主代理负责解包和筛选。本文“无授权照片时不造图”的原则仍成立；现在可以采用实际获授权的协会照片支持关于页与活动影像。研究子代理随后实际查看九图联系表及合影/讨论两张WebP，裁切与布局建议见 `photo-layout-review.md`；未核验照片日期、人物身份、活动名称或地点。

## 实际来源与取舍

### 1. Machine Learning at Berkeley：正式组织身份和 About 叙事

- 原始入口：https://ml.berkeley.edu/ ，实际重定向 https://ml.studentorg.berkeley.edu/ ，HTTP 200，页面标题 `Machine Learning at Berkeley`。
- 关于页：https://ml.studentorg.berkeley.edu/about ，实际加载并读取；同页面标题。
- 实看截图：`ml-berkeley-viewport.png`、`ml-berkeley-about-viewport.png`、`ml-berkeley-about-mission.png`。完整页面亦保存 `ml-berkeley-desktop.png`、`ml-berkeley-about-desktop.png`。

**观察到的结构：** 首页顶部是品牌和 About/Education/Partnerships/Research/Apply 横向公开导航；首屏使命陈述、解释和两个入口，下面分别展开合作、研究、教育。About 先用真实学生照片建立组织情境，接组织简介、Our Mission、External/Education/Research/Projects、Community、Executive Team。不是把组织数据库字段逐项塞进一个大卡片。

**采用：** 网站先回答“我们是谁、在做什么、怎样了解或参与”；公共导航按访客任务排列；About 用短段落和实践方向组织叙事。部门和成员可作为事实支撑放在叙事后，不必充当第一屏。

**拒绝：** 神经网络节点背景、密集合作方标志、全大写小眉题，以及本协会没有来源的赞助、团队、照片和成果。其浅色调和大照片不能直接替换用户已认可的深色几何。本站没有可公开照片时，用真实文字与现有数据排版，不生成“协会合影”。

**对本项目的原因：** 当前需要纠正“后台工作台”印象，组织身份比任务数量更重要。采用正式公共导航与叙事序列，保留原 Hero 材质和冷光，能在不丢失既有视觉记忆的前提下转换产品定位。

### 2. Hugging Face：论坛主题流与真正的图文文章

- 社区：https://discuss.huggingface.co/ ，HTTP 200，页面标题 `Hugging Face Forums - Hugging Face Community Discussion`。
- 公开长文： https://discuss.huggingface.co/t/release-avalanche-ultra-low-vram-matrix-factorized-optimizer-for-pytorch-up-to-99-99-memory-reduction/191097 ，实际加载，标题 `[Release] Avalanche: Ultra-Low VRAM Matrix-Factorized Optimizer for PyTorch (Up to 99.99% Memory Reduction) - 🤗Transformers - Hugging Face Forums`。
- 博客：https://huggingface.co/blog ，页面标题 `Hugging Face – Blog`。
- 从博客真实链接进入图文：https://huggingface.co/blog/nvidia/simready-central-assets-robotics-ai-factories ，页面标题 `Announcing SimReady Central: An Open Library of Simulation-Ready 3D Assets for Robotics and AI Factories`。
- 实看截图：`huggingface-discuss-viewport.png`、`huggingface-topic-viewport.png`、`huggingface-blog-list.png`、`huggingface-article-viewport.png`、`huggingface-article-body.png`。完整图亦保存。

**观察到的结构：** Forums 匿名可读；左侧是分类，主列是主题行，标题最强、分类与更新时间次之，相关作者和回复统计在侧。长文采用较窄阅读列，含分级标题、段落、列表、代码与外链。博客页以 `Community Blog & Articles` 为主要标题，分类条在上，只有一个 `New Article` 入口；文章摘要流用标题、图片、作者和日期建立扫描秩序。图文文章约 700px 宽的正文列按标题→作者/日期→实际图片→正文继续排列，图片与文字同行宽，正文包含图注、表格和链接。

**采用：** 分类和文章流；条目以标题、摘要、作者/日期为主；进入详情后以连续正文阅读为主；写作入口集中；支持真实图文、图片替代文本与图注。为本协会保留正文约 760px 上限，并沿用现有无衬线中文字体与深色表面。

**拒绝：** 把完整 Discourse 后台或多用户权限模型搬入当前单管理员项目；虚构回复、浏览、点赞、关注、热门或多头像；首屏庞大登录提示；装饰标签小字；白底衬线风格。站点真实出现这些功能，只能证明它们属于该站，不自动证明本项目应加入。

**证据边界：** 实看的两篇论坛帖子没有提供足以采用的正文图片案例，因此补看同一社区的博客文章，而没有把头像或 emoji 说成图文证据。文章中的技术性能、产品和研究结论未由本轮核验，不纳入协会内容、不作事实背书。研究只验证页面结构。

**对本项目的原因：** 用户需要像社区文章一样阅读和发布，而不是在公开卡片上修改结构化数据库字段。以成熟图文阅读结构配合发布中心，可以满足当前单管理员维护需求，无需引入未经授权的评论与账号系统。

### 3. PyCon US 2026：日期和时间决定排程层级

- URL：https://us.pycon.org/2026/schedule/ ，HTTP 200，页面标题 `Conference Schedule - PyCon US 2026`。
- 实看截图：`pycon-schedule-viewport.png`、`pycon-schedule-grid.png`；完整页面 `pycon-schedule-desktop.png`。

**观察到的结构：** 顶部公共导航；日程分 Tutorials / Sponsor Presentations / Talks 等组。实际滚到日程后，日期 tab 在上，房间为列，时间为行；单个活动块中题目、讲者、房间层级清楚，同一时间段共享表格边界。

**采用：** 清晰的时间定位、连续边界、日期切换与地点信息。转译为协会实际需求：桌面七日周列、日期/星期为列头、活动块先时间再标题/地点；手机改按日期分组的纵向日程。日历结构始终存在，空周也能上周/本周/下周导航。

**拒绝：** 霓虹城市、满屏装饰头图、发光表格边框、多会场会议的复杂度。不能把参考里的会议日期、讲者、活动套入协会；不能通过编造活动让空日历看起来丰富。

**对本项目的原因：** “恢复排程”要求的是日期可见和事件分布可比较。用周视图组织真实活动能提高实用性；设计无需添加装饰小字与状态光点。完整年份缺失的旧 MM-DD 数据另列“日期待完善”，不能靠当前年份猜测位置。

### 4. Luma：活动发现与具体日历相互补充

- https://lu.ma/ai 实际重定向 https://luma.com/ai ，HTTP 200，页面标题 `人工智能活动 · Luma`。
- 从该页真实 `Latent.Space` 链接进入 https://luma.com/ls?k=c ，实际最终 URL https://luma.com/ls ，页面标题 `Latent.Space · 活动日历`。
- 实看截图：`luma-ai-viewport.png`、`luma-calendar-viewport.png`；完整图 `luma-ai-desktop.png`、`luma-calendar-desktop.png`。

**观察到的结构：** AI 分类页先解释内容范围，再按月份组织活动行；标题、地点、日期并置。具体日历先展示组织身份，再将按日期分组的活动列与月历组合，提供即将举办/往期切换；活动包括时间、标题、地点和可选图片。公开阅读不要求先登录。

**采用：** 先日期后活动的扫描秩序；日历与列表两种视图互补；标题比辅助信息更强；有真实图片时作为内容补充，无图片时完整文字布局依然成立。

**拒绝：** 圆点时间轴、低对比小字、头像叠放、订阅数和报名数、订阅或提交活动等未实现能力；本轮不照搬月历到周排程造成双重导航负担。

**对本项目的原因：** 活动既需要快速找“何时何地”，也需要在小屏纵向阅读；这比在每条活动上摆编辑和状态统计更接近正式协会官网的访客需求。

## 不可用来源

https://acm.stanford.edu/ ：Chrome `page.goto` 返回 `net::ERR_CONNECTION_CLOSED`。本次未取得有效页面标题或内容截图，不推断该站设计，也未反复重试或绕过访问限制。已满足四组可访问同类来源，不需用失败链接凑数。

## 可执行设计转译

| 区域 | 采用的结构 | 本项目约束与验收点 |
|---|---|---|
| 公共导航 | 品牌、六主项、明确发布入口 | 首页/社区/项目/活动/成果/关于；辅助成员/竞赛/足迹在更多或页脚可达；320不挤压小字；手机菜单键盘可达 |
| 社区列表 | 分类条、连续文章流 | 标题、摘要、作者、日期；图片可选；不伪造互动计数；公开条目无编辑 |
| 文章阅读 | 连续窄正文 | 约760px上限，16px正文；图片不溢出，图注与alt可编辑；手机不先堆元数据挡正文 |
| 发布中心 | 单一写作/维护入口 | 登录仅在此触发；草稿/发布清楚；失败、图片上传、预览与离开保护不能丢内容 |
| 关于 | 身份→实践→组织→参与 | 不用首字下沉/巨卡/重复统计；只写已有来源事实；联系方式缺失明确待公布 |
| 活动 | 周日期架构+纵向列表 | 连续7日、空周、跨月/跨年、上周本周下周、手机分日；合法完整日期才能入日历 |

背景继续 `#090d14`，表面 `#111925/#172230`，主字 `#edf3fa`，辅助 `#a1afbf`，交互 `#5797ff`。文字用内容与间距产生层级，必要辅助不低于14px；触控至少44px。几何表达只放在适当的标题区，不能降低文章阅读对比。原Hero的偏左、旋转与局部光面属于 must-preserve。

以上规格是调研向项目的设计转译，属于 recommendation，不是参考站原样规格或Morgan已验收画面。正式方案已由主代理在实现前落盘；实际 Visual Director 以其为输入审方向。

## Grounding Statement

- Reality level: R1风格参考 + R2站点结构观察。
- Output mode: 实际网页观察与设计建议分列。
- Sources: 上述第一方公开页面；页面内容本身为来源，不以模型记忆替代访问。
- Retrieval date: 2026-10-28；源页可能继续变化，截图保留此次状态。
- Verified claims: 页面可访问性、标题、公开导航、可见结构与实际图片存在。
- Unverified: 源文章技术结论、其组织自述的外部真实性、后台发布流程、登录后的权限；本协会历史/人数/联系方式不在研究范围。
- License: 截图仅作内部审查证据；没有授权复用参考品牌、照片、插画或文字到成品。
- Suitable for: 本次公共官网/图文阅读/排程设计决策。
- Not suitable for: 协会事实填充、技术真实性背书或直接复制参考站。

## Employee Dispatch Report

- Researcher mode: `generic_codex_subagent`，证据 `/root/page_review`。
- Requested employee: `morgan-visual-director`。
- Employee mode: 实际 `hermes_profile_employee`，使用 `hermes --profile morgan-visual-director chat -Q --query-file .../director-direction-brief.md --max-turns 6 --run-budget 180`。
- Receipt: 命令输出保存 `director-direction-runtime.txt`，会话 `20261028_181959_315a35` 正常exit0，明确文字方向Approve、允许进入实现；结论和约束已写入 `director-direction.md`。
- Boundary: 本研究不修改生产源码、数据库、全局规则；实际员工只审方向，本次不走图片工具、不冒充成品截图验收。

## Skill / Tool Report

- Used skills: research（第一方来源与单文档结论）、playwright（真实浏览器查验）；研究者本身为后台委派代理。
- Used tools: Node REPL + Playwright Chrome（独立context）、`view_image`（实看参考画面）、文件工具（仅研究证据与brief）、Hermes CLI（实际方向审查）。
- Not used: 图片生成（没有制作资产的需要）、生产编辑与数据库写入（不属本子任务）、外部账号登录/发布（研究无需）。
- Verification: 来源manifest、真实截图、精确页面标题与失败记录；实际员工回执另存。
- Unverified: 实现后的视觉质量、移动端成品、交互完整性及Morgan最终视觉接受须由后续阶段验证。
