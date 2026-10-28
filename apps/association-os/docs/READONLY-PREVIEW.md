# 免费额度中的官网只读预览

2026-10-28，Morgan 决定先使用现有 CloudBase 环境的免费额度，让官网可公开打开。完整数据库、上传与管理员维护留待下一阶段。

## 构建

在本应用目录安装既有依赖后运行：

```powershell
node scripts/build-readonly-preview.mjs
```

脚本创建独立 `.next-readonly-preview-<timestamp>` 目录，仅复制应用源码与公开素材。在隔离的 `seed-data` 中新建示例库，不读取或复制本地运行库、用户上传、`.env`、管理员凭据。输出 `PREVIEW_UPLOAD` 指向可上传目录，里面只有精简 package.json 和 dist 静态文件。不要上传整个工作目录。

预览使用 Next.js 原生静态导出，保留 React 交互、Three.js Hero、筛选、周历、手机菜单与已选协会照片。此版本 Next.js 的静态导出缺失部分导航预取分段，因此独立预览采用普通页面链接；实际应用源码不变。公开 GET 数据导出为 `/preview-data/*.json`，列表与详情使用同一隔离示例库。全站明确披露只读与示例数据。

`/publish/`、`/login/`、`/admin/` 只显示维护未开放说明。构建不包含管理接口、写接口、登录表单或真实数据库；这不是后台权限的替代实现，也不是完整功能上线。

## 腾讯云目标

- EnvId：`promptcraft-mobile-d5c9d8298dd06`（上海，既有体验环境）
- 独立应用：`csust-maker-hub-preview`
- 公网地址：https://csust-maker-hub-preview-promptcraft-mobile-d5c9d8298dd06.webapps.tcloudbase.com/
- 上传方式：CloudBase `manageApps(deployApp)`，framework=static，installCmd/buildCmd 为空，buildPath=dist。
- 不覆盖 `promptcraft-mobile-demo`、环境根站点或 `an520.xin`；不新购环境、不升级、不启用自动续费。

平台提供的是体验域名，访问限制以腾讯云实际策略为准；不要把一次访问成功表述为大陆全网长期可用。自有域名、生产持久化、备份恢复和旧站数据迁移均未完成。

实测构建 `2609710315` / 版本 `csust-maker-hub-preview-001` 为 SUCCESS。首次访问需等待腾讯云测试域名提示倒计时并点击“确定访问”。之后首页、详情直接刷新、照片、社区、活动及手机菜单正常；没有页面脚本异常或资源失败。当前托管会对不存在路径以及 POST 返回首页 HTML 和 HTTP 200（软404），不代表接口存在或写入成功；正式上线需单独配置错误文档/请求方法策略。

生成产物不提交 Git。需要完整功能部署时按 DEPLOYMENT.md 配置持久数据库、图片目录与管理员认证，不要在静态预览中开启写入。
