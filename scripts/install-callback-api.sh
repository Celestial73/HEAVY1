#!/usr/bin/env bash
# Установка API обратного звонка на VDS (Python + systemd + nginx location).
#
#   chmod +x scripts/install-callback-api.sh
#   ./scripts/install-callback-api.sh
#
# Перед запуском: добавьте в nginx location /api/callback (см. nginx-heavy.conf.example)
# и укажите SMTP_PASS в /etc/heavy/callback.env

set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="/etc/heavy/callback.env"
SERVICE_NAME="heavy-callback"
SERVICE_DST="/etc/systemd/system/${SERVICE_NAME}.service"

echo "==> REPO_DIR=${REPO_DIR}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Ошибка: нужен python3 (sudo apt install python3)"
  exit 1
fi

sudo mkdir -p /etc/heavy

if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> создаём ${ENV_FILE} из примера — отредактируйте SMTP_PASS"
  sudo cp "${REPO_DIR}/server/callback/callback.env.example" "$ENV_FILE"
else
  echo "==> ${ENV_FILE} уже есть, не перезаписываем"
fi

sudo chmod 640 "$ENV_FILE"
sudo chown root:www-data "$ENV_FILE"

echo "==> systemd unit ${SERVICE_NAME}"
sudo sed "s|REPO_DIR_PLACEHOLDER|${REPO_DIR}|g" \
  "${REPO_DIR}/scripts/systemd/heavy-callback.service" | sudo tee "$SERVICE_DST" >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

if grep -q 'SMTP_PASS=ваш_пароль_приложения' "$ENV_FILE" 2>/dev/null; then
  echo ""
  echo "Внимание: задайте SMTP_PASS в ${ENV_FILE}, затем:"
  echo "  sudo systemctl restart ${SERVICE_NAME}"
  echo "  curl -sS -X POST https://lead-elephant.ru/api/callback -H 'Content-Type: application/json' -d '{\"phone\":\"+79990000000\"}'"
  exit 0
fi

sudo systemctl restart "$SERVICE_NAME"
sudo systemctl --no-pager status "$SERVICE_NAME" || true

echo ""
echo "OK. Проверка (локально на VDS):"
echo "  curl -sS -X POST http://127.0.0.1:8787/api/callback -H 'Content-Type: application/json' -d '{\"phone\":\"+79990000000\"}'"
