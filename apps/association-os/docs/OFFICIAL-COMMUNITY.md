# 官网与图文发布交接

2026-10-28。新版在 `apps/association-os` 独立运行，当前为可验证的协作预览，不替换 an520.xin 的原站。

## 浏览与维护

公开导航：首页、社区、项目、活动、成果、关于。成员、竞赛与足迹在页脚及移动菜单。所有公开内容免登录；维护统一进入 `/publish`，继续使用一名管理员。社区地址保留 `/library`。旧 `/模块/new` 和 `/模块/id/edit` 跳转到发布中心兼容地址。

发布中心先选择模块，再新增或编辑。社区文章支持 Markdown 工具栏、写作/预览、选择图片及粘贴剪贴板图片；上传后插入正文。图片说明用于替代文本，可加图注。先保存草稿，确认后把状态改为“已发布”并保存；保存后可继续编辑或查看公开页。没有新增成员注册、评论、点赞或自动报名。

管理员初始化参见 [LOCAL-ADMIN.md](LOCAL-ADMIN.md)。密码由维护者自行选择，不提供仓库默认管理员密码。

## 数据与媒体

SQLite 自动迁移至 v5：增加 `items.body_format`、`media_assets`、`item_media`。旧内容保留 plain，避免历史特殊符号被意外当作 Markdown。新媒体在 `AI_ASSOCIATION_DATA_DIR/media`。接口、校验、事务、草稿图片访问及备份边界详见 [MEDIA-STORAGE.md](MEDIA-STORAGE.md)。数据库文件与本地账号不进入 Git；代码中的初始化样例不代表协会运营实绩，界面保留示例披露。

用户提供的五张官网固定照片位于 `public/images/association`，来源和处理记录在该目录 README。其他照片未选入网站，原始压缩包未提交。后续发布者上传的图片是运行数据，不能当成静态源码一并覆盖。

周排程以 Asia/Shanghai 的日期计算；只把合法完整 YYYY-MM-DD（可跟 HH:mm）活动编入周历。旧 MM-DD 单独展示“日期待完善”，不猜年份。排程空白是当前真实数据状态，不用假活动填充。

## 与原站服务器的边界

用户提供的《长理创客站-上手指南》描述的是另一套系统：根目录 Astro 5 静态站、JSON 运营数据、Node后台、csust-admin服务。该指南中的静态dist部署步骤不适用于本应用；服务器源码快照无.git，不能假设可git pull。

新版的 GitHub 提交只更新独立应用和交接文档，不覆盖根目录 `content/items.json`、线上 `metrics.json`、`.env.admin`，也没有把原站后台 token 当成 SSH 权限。生产部署仍需正式授权的 SSH 公钥及独立 Node 服务/持久数据目录/反代与备份安排。保持当前主站，先部署独立预览的既定决定有效。

旧站真实运营内容尚未导入新版；不能把本地示例库提交当作完成运营数据迁移。协作者可按运行说明安装、初始化、预览并继续维护。

## 设计资料

研究使用 ML at Berkeley、Hugging Face Forums/Blog、PyCon US schedule、Luma 的真实公开页面，采用组织叙事、主题流和日期结构，保留本站冷色深色与 Hero 原几何。详细方案见 `OFFICIAL-PLAN.md`，研究见 `REFERENCE-RESEARCH.md`。技术测试通过与视觉/用户验收分别记录，不以构建成功代表工业化完成。
