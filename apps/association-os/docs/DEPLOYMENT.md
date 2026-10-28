# 新版服务器交接与部署

日期：2026-10-28。用户选择先独立预览，保留当前主站。旧站位置来自仓库 README.md、docs/contributing.md、docs/zcode-handoff.md；本轮尚未通过 SSH 验证服务器实时状态。

## 已有部署

| 项目 | 交接文档登记值 |
|---|---|
| 主站 | https://an520.xin |
| SSH | ubuntu@43.161.198.195 |
| Web 服务 | Caddy |
| 旧站源码 | /home/ubuntu/csust-maker-hub（历史登记为无 .git 快照） |
| 静态目录 | /var/www/csust-maker |
| 旧后台 | csust-admin.service，127.0.0.1:3210 |
| 每日构建 | csust-build-daily.timer |

旧站 push 不等于上线；原方式是 rsync 静态产物。新版有 API 和 SQLite，不能当静态 dist 上传，也不能用旧站清理式同步命令覆盖源码、数据库和密钥。

## 独立预览步骤

部署入口、管理员和服务器权限由负责人配置。使用独立目录、Node 进程、数据目录和预览地址；对外地址未配置前可通过 SSH 隧道访问。以下是模板，并非已执行记录。

```bash
# 在服务器建立新目录，不替换旧站目录
git clone --branch codex/association-os-handoff https://github.com/rml4791lol-lang/csust-maker-hub.git csust-maker-next-preview
cd csust-maker-next-preview/apps/association-os
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm start --hostname 127.0.0.1 --port 3100
```

使用与验证环境一致的 Node 26.7.0 / pnpm 11.10.0，先检查端口和磁盘可用性。由进程管理器提供 ADMIN_USER、ADMIN_PASSWORD 和独立 ADMIN_SESSION_SECRET，不把密码放命令行、Git 或聊天。未配置凭据时公开页面可浏览，后台不可用。

协作者可用 SSH 隧道查看（本机执行，需已获服务器权限）：

```bash
ssh -N -L 3100:127.0.0.1:3100 ubuntu@43.161.198.195
```

访问 <http://127.0.0.1:3100/>；本机 3100 已占用可把隧道本地端口改成 3102。SSH 私钥由本人保管，不随源码共享；新增协作者使用各自公钥，由站长授权。

## 常驻与反向代理

- 新建独立 systemd 服务或采用已批准的进程管理方式，工作目录为新版应用目录，仅监听 loopback；不覆盖旧后台服务。
- 独立 HTTPS 主机可用 Caddy reverse_proxy 127.0.0.1:3100。域名、DNS、证书及现有配置需先核对；本文不声称已有预览域名。
- HTTPS 反代需实测登录、退出、同源校验及 Secure cookie。当前实现依赖请求协议和 Host，生产行为未验证；不要通过删除同源校验修复登录。
- 改 Caddy 前备份，validate 通过后 reload，保留其他域名和旧站路由。

## 数据、更新与回滚

默认数据库为 data/app.db；新文章媒体为 DATA_DIR/media，随 AI_ASSOCIATION_DATA_DIR 设置。旧足迹附件仍在应用工作目录 data/uploads，不随该变量迁移。详见 MEDIA-STORAGE.md，备份需同时涵盖这两个位置；切换 release 目录前先统一旧附件存储。

备份应在停止新版写入后复制数据库和附件。SQLite 使用 WAL 时不要只复制运行中的 app.db；也可用 SQLite 在线备份 API，但必须验证恢复。备份保存在受限位置，不上传 GitHub。恢复演练至少检查 quick_check、foreign_key_check、记录数量、附件及登录读写。

迁移在首次数据库访问时自动运行，升级前备份、升级后验证。数据库版本改变时不能只回滚代码，须核对兼容性并恢复对应备份。旧站未切换时，预览回滚只需停新版服务和撤回独立预览路由。

## 切主站前未完成项

旧站运营数据字段映射与迁移、生产权限核验、旧附件统一存储、恢复演练、真实 HTTPS 登录与 CRUD 验证。保留旧后台、定时任务及其他站点的恢复路径，再安排主站切换。
