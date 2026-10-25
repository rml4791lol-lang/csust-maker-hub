# GLOSSARY

本站的领域词汇表。工程技能（issue、refactor、测试命名）输出时用这里的词，不用同义词。

## 内容模型

- **内容条目（item）**：站内一条记录，id 唯一，真源在 `content/items.json`。不叫「文章 / 帖子 / 页面」。
- **五类内容**：`guide`（攻略）/ `skill`（技能指令）/ `template`（模板素材）/ `link`（外部项目）/ `training`（培训）。当前的内容标准。
- **历史类型**：`project` / `competition` / `activity` / `course` / `video`。保留兼容、逐步迁移，不新增。
- **g01 样板**：内容写作标准的事实样板——scene / path / prompt / pitfalls / usage 五段。「判断标准：没做过的人照着做完，能产出东西」。
- **发布状态（publishState）**：`draft → reviewing → published → unpublished` 的状态机；覆盖文件是 `src/data/publish-state.json`，流转记录在 `review-log.json`。
- **复核（review cycle）**：发布即盖复核章；已发布条目超过 `REVIEW_DAYS`（默认 90 天）未复核进入「待复核」清单。
- **过期（expiresAt）**：条目级到期日。过期不隐藏，列表标「已截止」、详情页顶部提示。
- **合规红线**：不涉政治宗教民族敏感；不发他人隐私与未公开数据；不转载未授权付费内容与破解教程。发布前逐条确认。

## 运营

- **值班期（duty shift）**：双周轮换的内容生产排班，配置在 `site.ts` 的 `dutyRota`，展示在数据页。
- **运营简报（daily brief）**：每天 03:30 构建后推送给管理员的卡片（新增反馈 / 浏览 Top3 / 即将到期）。
- **照做（confirmed）**：反馈三态之一（有用 / 没用 / 照做出来了），成功标准「1 人照着做出东西」的直接度量。
- **真源（双真源）**：内容条目的运营真源在**服务器** `content/items.json`（后台与 agent API 写它）；代码真源在 **git main**。同步规则见 `docs/contributing.md`。

## 架构

- **后台（admin server）**：`scripts/admin-server.ts`，服务器 systemd 单元 `csust-admin`，人用 Basic Auth、agent 用 Bearer token。
- **agent API**：`/admin/api/*` 下的 CRUD / state / review / metrics / scaffold 端点，挂在 `an520.xin/admin` 反代后。
- **数据带（strip）**：首页从内容实时推导的统计条（成员数 / 条目数 / 攻略数 / 进行中）。
- **标签牌（plate）**：内容类型「单字 + 类名」的档案标签视觉系统（攻 / 令 / 模 / 链 / 训）。
- **构建烟雾检查（smoke）**：`pnpm test:smoke` 对 `dist/` 产物的外部行为断言，是部署前的最后闸门。
