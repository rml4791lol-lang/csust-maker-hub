# AI 协会数字平台（Next.js 新版）

协会工作台、内容库、成员、项目、竞赛、活动、成果和足迹。技术栈为 Next.js 16 / React 19 / TypeScript / Tailwind 4 / SQLite，Hero 使用 Three.js 与 Motion。

这是可运行的协作原型。首次启动会创建带「示例数据」标识的数据库；尚未迁移 an520.xin 旧站运营内容。GitHub 主站是 Astro 工程，新版在协作分支的 `apps/association-os/`，两套应用分别安装、启动和部署。

## 开发启动

本次验证环境：Node.js **26.7.0**、pnpm **11.10.0**。项目使用 `node:sqlite`，请优先与验证版本保持一致。

```bash
# 在 csust-maker-hub 仓库的协作分支中
cd apps/association-os
pnpm install --frozen-lockfile
pnpm dev --hostname 127.0.0.1 --port 3100
```

打开 <http://127.0.0.1:3100/>。单独收到本应用源码包时，直接在含本文件的目录运行命令，无需再次 cd。

公开页面不需要登录。录入与修改统一进入 `/publish` 发布中心，只有维护内容时才要求管理员登录。管理员可通过启动进程的环境配置设置下表变量；本机预览也可按 [本机管理员初始化](docs/LOCAL-ADMIN.md) 自己创建账号。本仓库不提供默认密码，也不包含本机环境文件。

| 变量 | 用途 |
|---|---|
| `ADMIN_USER` | 管理员用户名；与密码都配置后才启用后台 |
| `ADMIN_PASSWORD` | 管理员密码；由负责人通过安全渠道单独配置 |
| `ADMIN_SESSION_SECRET` | 建议独立配置的随机会话签名材料 |
| `AI_ASSOCIATION_DATA_DIR` | SQLite 目录，默认当前应用的 `data/` |
| `AI_ASSOCIATION_BUILD_DIR` | 构建目录，默认 `.next`；build 与 start 必须使用一致值 |

登录会话持续一小时。更改管理员凭据会使已有会话失效。现阶段是单管理员账号，没有成员个人账号。

## 验证和生产启动

```bash
pnpm lint
pnpm test
pnpm build
pnpm start --hostname 127.0.0.1 --port 3100
```

测试使用内存或隔离 fixture，不需真实管理员账号。构建可能初始化示例数据库；验证时应使用独立副本和数据目录，不要借用线上数据库。生产运行需要常驻 Node 进程与可写持久磁盘，不能按 Astro 的静态 dist 文件方式部署。

## 交接入口

- [协作方式、源码位置与已知限制](docs/HANDOFF.md)
- [如何录入与修改内容](docs/CONTENT-OPERATIONS.md)
- [二三级页面、共享样式与迁移说明](docs/PAGE-SYSTEM.md)
- [已有服务器与新版部署步骤](docs/DEPLOYMENT.md)

不要提交 `.env*`、`data/`、数据库或用户附件。应用源码与业务数据分开交接。`scripts/` 是历史开发辅助脚本，部分会修改数据或源码，不属于启动流程，请勿批量运行。

## 2026-10-28 官网与图文发布

公开阅读与内容维护已分离，统一维护入口 `/publish`。新增图文编辑、私有默认图片上传、v5数据库迁移、活动周历及真实协会照片。参见 [官网与发布交接](docs/OFFICIAL-COMMUNITY.md)、[设计方案](docs/OFFICIAL-PLAN.md)、[媒体存储](docs/MEDIA-STORAGE.md) 与 [本轮验证和验收边界](docs/VERIFICATION-20261028.md)。
