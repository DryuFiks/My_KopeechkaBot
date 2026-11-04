#!/usr/bin/env bash
# Установка релиза на сервере (MKB-046). Запускает scripts/deploy.ps1 по ssh:
#   bash /tmp/install-release.sh /tmp/kopeechka-app.tgz
# Текущая версия сохраняется рядом (*.prev) — откат: deploy/release/rollback-release.sh.
# Если sql/ изменился: сначала бэкап с копией админу, потом миграции, потом перезапуск.
set -Eeuo pipefail

archive="${1:?Укажите архив релиза}"
APP_DIR="${APP_DIR:-$HOME/bot}"
DB_NAME="${DB_NAME:-My_KopeechkaBot}"
cd "$APP_DIR"

new="$(mktemp -d)"
trap 'rm -rf "$new"' EXIT
tar -xzf "$archive" -C "$new"

migrate=0
diff -rq "$new/sql" sql >/dev/null 2>&1 || migrate=1

# Одна предыдущая версия: старый *.prev удаляется, текущая становится *.prev.
rm -rf dist.prev webapp/dist.prev sql.prev package.json.prev package-lock.json.prev RELEASE.prev
for p in dist webapp/dist sql package.json package-lock.json RELEASE; do
  if [[ -e $p ]]; then mv "$p" "$p.prev"; fi
done
mkdir -p webapp
mv "$new/dist" dist
mv "$new/webapp/dist" webapp/dist
mv "$new/sql" sql
mv "$new/package.json" "$new/package-lock.json" "$new/RELEASE" .

npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null

if ((migrate)); then
  echo "sql/ изменился: бэкап и миграции"
  sudo kopeechka-backup --send
  # Файлы читает этот shell (stdin), а не postgres: домашняя папка ему может быть недоступна.
  for f in sql/schema.sql $(ls sql/0*.sql | sort); do
    echo "  $f"
    sudo -u postgres psql -q -X -v ON_ERROR_STOP=1 -d "$DB_NAME" <"$f"
  done
fi

sudo systemctl restart kopeechka
sleep 5
if systemctl is-active --quiet kopeechka; then
  echo "OK: запущен релиз $(cat RELEASE)"
  sudo journalctl -u kopeechka -n 5 --no-pager
else
  echo "ОШИБКА: служба не поднялась. Откат: .\\scripts\\rollback.ps1" >&2
  sudo journalctl -u kopeechka -n 30 --no-pager >&2
  exit 1
fi
