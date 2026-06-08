#!/usr/bin/env bash
# Деплой на VDS: только git pull, сайт уже собран в dist/ в репозитории.
# Первый раз: git clone <repo> /var/www/heavy && nginx root → /var/www/heavy/dist
#
# Использование:
#   chmod +x scripts/deploy-vps.sh
#   ./scripts/deploy-vps.sh
#
# Переменные:
#   REPO_DIR=/var/www/heavy   — каталог клона
#   DEPLOY_BRANCH=main        — ветка

set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

cd "$REPO_DIR"

echo "==> git pull origin ${DEPLOY_BRANCH}"
git pull --ff-only origin "$DEPLOY_BRANCH"

if [[ ! -f dist/index.html ]]; then
  echo "Ошибка: dist/index.html нет. В репозитории должен быть закоммичен результат npm run build."
  exit 1
fi

if systemctl is-active --quiet heavy-callback 2>/dev/null; then
  echo "==> heavy-callback restart"
  sudo systemctl restart heavy-callback
fi

if command -v nginx >/dev/null 2>&1; then
  echo "==> nginx reload"
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "OK: $(git rev-parse --short HEAD) — dist готов, $(date -Is)"
