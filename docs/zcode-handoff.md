# 交接指令：长理创客内部知识站（交给 ZCode 继续开发）

把下面整段直接粘给 ZCode。

---

## 任务

继续开发「长理创客内部知识站」。项目已上线，现在要把内容和后台做完整。

**项目路径**：`/Users/an/Desktop/Atlas/长理创客/技术分享网站`
**线上地址**：https://an520.xin
**代码仓库**：https://github.com/rml4791lol-lang/csust-maker-hub（main 分支）

## 先做的事（不要跳过）

1. 读 `AGENTS.md`、`README.md`、`docs/specs/0001-internal-knowledge-site-v2.md`
2. 读 `src/data/items.ts` 的类型定义，理解 Item 结构
3. 读 `content/items.json` 里 `g01`（用 AI 把部门周报自动化）这条，它是**内容标准样板**
4. 跑起来：`pnpm dev --port 4321`，打开 http://localhost:4321

## 技术栈与命令

- Astro 5 + Tailwind 4，纯静态输出，包管理用 `pnpm`
- `pnpm dev --port 4321` 本地开发
- `pnpm build` 构建到 `dist/`
- `pnpm test` 内容校验（Vitest，11 条）
- `pnpm test:smoke` 构建烟雾检查（需先 build）
- `pnpm admin` 启动后台（http://127.0.0.1:3210，默认 admin/admin123）

## 架构要点

- **内容真源是 `content/items.json`**，`src/data/items.ts` 读取它并加类型
- **发布状态**在 `src/data/publish-state.json`（覆盖 JSON 里的默认值），审核日志在 `review-log.json`
- **后台** `scripts/admin-server.ts`：人用 Basic Auth 点按钮；agent 用 `Authorization: Bearer $AGENT_TOKEN` 调 API
- **agent 可用接口**：`GET/PUT/DELETE /api/items[/:id]`、`POST /api/state`、`POST /api/build`
- 五类内容：`guide`（攻略）/ `skill`（技能指令）/ `template`（模板）/ `link`（外部项目）/ `training`（培训）；另有 5 个历史类型 `project/competition/activity/course/video` 保留兼容（`items.json` 里还有这些条目），一切以 `src/data/items.ts` 的类型定义为准
- 过期：`expiresAt` 字段，过期不隐藏，列表标「已截止」、详情页顶部提示
- 部署：`rsync -az --delete --chmod=D755,F644 --exclude '.DS_Store' -e "ssh -i ~/.ssh/tencent_hk_hermes.pem" dist/ ubuntu@43.161.198.195:/var/www/csust-maker/`

## 要做的事（按优先级）

### P0：把剩余内容按标准重写

现在只有 `g01`、`g02` 两条攻略是完整版。`g04`/`g06`/`g07`/`g08` 是半完整攻略（有部分字段但不够标准），其余 18 条（skill/template/training 等）太浅（3 行步骤）。先重写 4 条攻略，再充实其他类型，都按 `g01` 的标准：

**每条攻略必须有：**

1. `extra.scene`：具体场景。要写到「周五 17:00 要交」「平均花 90 分钟」这种程度，不写「提高效率」这种空话
2. `extra.path`：4~6 步，每步要能照着做。写清用什么工具、点什么、说什么
3. `extra.prompt`：完整可复制的提示词，带硬性要求（禁止空话、保留数字、不确定标 `[待补充]`）
4. `extra.pitfalls`：3 条真实容易踩的坑，不要写「注意安全」这种废话
5. `extra.usage`：谁用过、用了多久、效果如何，有数字

**判断标准**：一个没做过的人照着做完，能产出东西。

### P1：把后台部署到线上

现在后台只跑在本机。要求：

- 服务器 `ubuntu@43.161.198.195` 上放源码（或至少 Node 能跑的产物）
- systemd 服务守护 `pnpm admin`
- Caddy 加路由：`an520.xin/admin` 反代到 `127.0.0.1:3210`
- 注意：这台服务器还跑着其他服务（tryon、buy、ai、info-tech 等），**不要动其他站点的 Caddy 配置**

### P2：定时构建

内容改完要重新构建才生效。加一个每天凌晨的定时构建（cron 或 systemd timer），让过期标注、内容更新自动生效。

### P3：真实数据替换

现在成员和部分内容是示例数据。等用户提供真实名单后替换 `src/data/members.ts`。

## 硬约束（违反就是做错）

1. **设计风格**：白底、黑字、单一蓝色点缀（`#1a56db`）。不做渐变、不做紫色、不做营销卡片、不做轮播
2. **不做搜索框**：一期内容少，靠浏览
3. **不做提需求 / 服务台 / 工单**：已整体移除，不要加回来
4. **不做账号注册**：后台只有 2 个管理员 + 1 个 agent token
5. **不做视频托管**：视频只存外部链接
6. **内容必须具体真实可用**：不写方法论空话，每条要有可执行步骤和产出
7. **合规红线**：不涉政治宗教民族敏感；不发他人隐私与未公开数据；不转载未授权付费内容与破解教程
8. **全站 noindex**：内部使用，不被搜索引擎收录
9. **中文排版**：标题 `text-wrap: balance`，正文 `text-wrap: pretty`，数字统一 `tabular-nums`，字号用 `var(--text-*)` token
10. **不做滚动隐藏**：内容始终可见

## 验收标准

改完必须全部通过：

```bash
pnpm test        # 内容校验 11 条通过
pnpm test:smoke  # 构建烟雾检查通过
pnpm build       # 构建成功
```

然后部署，用浏览器验证：

- https://an520.xin/ 首页正常
- https://an520.xin/library 内容库能筛五类
- 任选一条攻略详情页，检查是否包含：场景 / 路径 / 提示词 / 常见错误 / 使用记录
- 手机宽度（390px）下不横向溢出

## 交付物

1. 改完的代码，提交到 main 分支并 push
2. 部署到线上
3. 汇报时给出：改了哪些内容、测试结果、线上截图

## 不要做的事

- 不要重构已有的构建/部署流程
- 不要引入新框架、新依赖（除了测试相关）
- 不要改动 `/Users/an/Desktop/Atlas/长理创客/技术分享网站` 以外的文件
- 不要碰服务器上其他站点的配置（`/var/www/an520-*`、其他 Caddy 路由）
