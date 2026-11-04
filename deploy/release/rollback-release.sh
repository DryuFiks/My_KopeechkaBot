#!/usr/bin/env bash
# Откат на предыдущий релиз (MKB-046). Запускает scripts/rollback.ps1 по ssh:
#   bash /tmp/rollback-release.sh
# Возвращает *.prev, ставит его зависимости и перезапускает бота. Хранится одна предыдущая версия.
# Миграции БД не откатываются: они только добавляют таблицы и колонки, старый код их не замечает.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/bot}"
cd "$APP_DIR"

if [[ ! -d dist.prev ]]; then
  echo "Нет предыдущей версии (dist.prev) — откатывать не на что." >&2
  exit 1
fi
for p in dist webapp/dist sql package.json package-lock.json RELEASE; do
  if [[ -e $p.prev ]]; then
    rm -rf "$p"
    mv "$p.prev" "$p"
  fi
done

npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null
sudo systemctl restart kopeechka
sleep 5
if systemctl is-active --quiet kopeechka; then
  echo "OK: откат выполнен, запущен релиз $(cat RELEASE 2>/dev/null || echo '(без метки)')"
  sudo journalctl -u kopeechka -n 5 --no-pager
else
  echo "ОШИБКА: после отката служба не поднялась" >&2
  sudo journalctl -u kopeechka -n 30 --no-pager >&2
  exit 1
fi
