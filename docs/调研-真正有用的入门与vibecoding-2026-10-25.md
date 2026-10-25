# 调研：对入门者和 vibecoder 真正有用的东西是什么

日期：2026-10-25。回答一个问题：站里的入门 / vibe coding 内容线，应该写什么、不该写什么。依据是有研究或工程共识支撑的结论，不是热度。

## 一、第一性原理

受众是学生创客，他们的产出物是：竞赛作品、课程项目、软著、给社团做的小工具。他们的约束是：钱少、时间碎、AI 工具唾手可得、（大部分人）还没形成编程习惯。所以「真正有用」的判定标准只有一条：

> 这条内容帮他们**产出了什么**、以及**留给他们自己什么**。

第二半句和第一半句一样重要——这是本次调研最重要的发现。

## 二、研究结论（按可信度排序）

1. **「要解释」和「要代写」是两种 AI，结局不同。** Anthropic 随机对照实验（52 名开发者，2026-01）：用 AI 直接生成代码的一组，事后理解测试低约 17%；用 AI 要解释、要思路的一组不掉分。对仍在校、习惯未成形的学生，这是路线分叉点。（[Anthropic Research](https://www.anthropic.com/research/AI-assistance-coding-skills)）
2. **用得越多，动脑越少。** Microsoft / CMU 2025 研究：工作中 AI 依赖度越高，行使批判性思维越少——认知被「萎缩且没准备好」。（广泛报道，Microsoft/CMU 联合研究）
3. **别信体感，量时间。** METR 2025：资深开源开发者用 AI 工具实际慢约 19%，但他们普遍**自以为**快了。→ 学生写「效率实测」类内容必须带计时，否则是感想。（METR study, 2025）
4. **vibe coding 的真实边界**：适合原型和小工具，跨不过「玩具 → 给别人用」这道坎；共识风险是不理解就上线、无人审查的代码累积安全洞（[ShiftMag](https://shiftmag.dev/vibe-coding-mistakes-how-to-avoid-them-9255)、[Addy Osmani](https://medium.com/@addyosmani/vibe-coding-is-not-the-same-as-ai-assisted-engineering-3f81088d5b98)、[ACM 研究](https://dl.acm.org/doi/10.1145/3786583.3786866)——vibe coder 用自然语言描述目标、试错迭代、不读代码）。
5. **派活能力（描述 + 验收）是 vibe coder 的核心技能**，不是语法。这印证了站里 g09-g11 / s02-s03 路线的方向。

## 三、对照现有 31 条的缺口与决策

| 缺口 | 研究依据 | 决策 |
|---|---|---|
| 没有一条讲「AI 与学习」的关系 | 结论 1、2 直接命中学生命根（考试/面试/答辩 AI 不在场） | ✅ 已写 **g12 用 AI 学东西的正确姿势** |
| 安全线完全空白（密钥/隐私/部署默认值） | 结论 4 的首要风险；学生项目真实事故高发 | ✅ 已写 **g13 Vibe coding 安全红线** |
| 「从玩具到能给人用」缺一环：免费部署上线的具体路径 | 结论 4 的坎 | 📌 下一条：**g14 免费部署**（GitHub Pages / Cloudflare Pages，含把 g09 的成品推上去的完整路径） |
| 效率类内容缺「量时间」的方法 | 结论 3 | 📌 约束进标准：以后所有「实测/省钱/对比」类条目 usage 必须带计时或计数，否则不收 |
| 复盘/沉淀机制 | 知识库运营调研的闭环逻辑 | 📌 s04「项目复盘提示词」（做完一个项目让 agent 提炼成站内新攻略的草稿）——内容站自举 |

**明确不写的**（热度高但对本受众无产出）：AI 岗位焦虑、框架选型大战、Agent 架构科普——没有可照做的产出，属于方法论空话，违反收录标准。

## 四、给内容线的三条硬规则（从研究推导）

1. **学习类内容必须区分「要解释」和「要代写」两种用法**，默认教前者。
2. **实测类内容必须带数字**（计时 / 计数 / 价格），无数字标 [待补充]，不接受「感觉快了很多」。
3. **安全红线类内容收录时逐条过合规三问**（政治敏感 / 隐私 / 未授权），安全知识本身也要合规地教（不教攻击，教护栏）。

## 来源

- [Anthropic — How AI assistance impacts the formation of coding skills](https://www.anthropic.com/research/AI-assistance-coding-skills)（随机对照实验，52 人，~17%）
- [ShiftMag — Vibe Coding Mistakes you can easily avoid](https://shiftmag.dev/vibe-coding-mistakes-how-to-avoid-them-9255)
- [Addy Osmani — Vibe coding is not the same as AI-assisted engineering](https://medium.com/@addyosmani/vibe-coding-is-not-the-same-as-ai-assisted-engineering-3f81088d5b98)
- [ACM — Vibe Coding in Practice: Motivations, Challenges, and a Better Way](https://dl.acm.org/doi/10.1145/3786583.3786866)
- [Red Hat Developers — The Uncomfortable Truth About Vibe Coding](https://developers.redhat.com/articles/2026/02/17/uncomfortable-truth-about-vibe-coding)
- [Tanium — What Is Vibe Coding?](https://www.tanium.com/blog/what-is-vibe-coding)
- METR 2025 RCT（资深开发者 +AI 慢 19%）与 Microsoft/CMU 批判性思维研究：见各报道转述，原始论文以机构发布为准
