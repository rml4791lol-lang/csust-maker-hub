#!/usr/bin/env bash
# 从服务器拉回运营真源：内容条目、发布状态、审核日志、功能开关、工具目录、运行指标。
# 用途：线上后台 / agent API 写的是服务器上的文件，本机 git 不自动同步——定期跑这个脚本再提交，
#       否则下次 rsync 上线会用本机旧文件覆盖服务器的运营改动（contributing.md「双真源」）。
#
# 用法：bash scripts/sync-from-server.sh   （私钥路径可用 KEY=... 覆盖，默认 ~/.ssh/tencent_hk_hermes.pem）
set -euo pipefail

KEY="${KEY:-$HOME/.ssh/tencent_hk_hermes.pem}"
SERVER="ubuntu@43.161.198.195"
SSH="ssh -i $KEY -o ConnectTimeout=10"

$SSH "$SERVER" 'test -d ~/csust-maker-hub/content' || { echo "服务器仓库不存在或连不上"; exit 1; }

rsync -az -e "ssh -i $KEY" "$SERVER:~/csust-maker-hub/content/" content/
rsync -az -e "ssh -i $KEY" "$SERVER:~/csust-maker-hub/src/data/publish-state.json" src/data/
rsync -az -e "ssh -i $KEY" "$SERVER:~/csust-maker-hub/src/data/review-log.json" src/data/
rsync -az -e "ssh -i $KEY" "$SERVER:~/csust-maker-hub/metrics.json" . 2>/dev/null || echo "（服务器还没有 metrics.json，跳过）"

echo "—— 拉取完成，以下文件的改动需要检查并提交 ——"
git status --short content/ src/data/ metrics.json 2>/dev/null || git status --short content/ src/data/
