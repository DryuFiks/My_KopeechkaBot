#!/usr/bin/env bash
# Бэкап БД Копеечки (MKB-044). На сервере: /usr/local/bin/kopeechka-backup, запускает systemd-таймер
# kopeechka-backup.timer от root (см. DEPLOY.md, «Резервная копия БД»).
#  - каждый день: pg_dump -Fc в $BACKUP_DIR, хранятся $KEEP последних копий;
#  - по воскресеньям (UTC) или с флагом --send: свежая копия шифруется gpg (AES256, пароль из $PASS_FILE)
#    и уходит администратору в Telegram — копия вне сервера на случай потери самой машины;
#  - при любой ошибке администратору приходит короткое сообщение.
set -Eeuo pipefail

DB_NAME="${DB_NAME:-My_KopeechkaBot}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kopeechka}"
ENV_FILE="${ENV_FILE:-/home/ubuntu/bot/.env}"
PASS_FILE="${PASS_FILE:-/etc/kopeechka/backup.pass}"
KEEP="${KEEP:-14}"
TG_LIMIT_BYTES=$((45 * 1024 * 1024)) # Bot API принимает документы до 50 МБ

# Только нужные строки из .env бота; файл целиком не исполняется.
env_value() { { grep -E "^$1=" "$ENV_FILE" || true; } | tail -n1 | cut -d= -f2- | tr -d "\r\"'"; }
BOT_TOKEN="$(env_value BOT_TOKEN)"
ADMIN_ID="$(env_value ADMIN_TELEGRAM_ID)"
if [[ -z $BOT_TOKEN || -z $ADMIN_ID ]]; then
  echo "BOT_TOKEN или ADMIN_TELEGRAM_ID не найдены в $ENV_FILE" >&2
  exit 1
fi

# URL с токеном уходит в curl через stdin, а не аргументом — не виден в списке процессов.
telegram() {
  local method="$1"
  shift
  printf 'url = "https://api.telegram.org/bot%s/%s"\n' "$BOT_TOKEN" "$method" |
    curl -sS --fail --max-time 120 --config - "$@" >/dev/null
}

on_error() {
  trap - ERR
  telegram sendMessage --form-string "chat_id=$ADMIN_ID" \
    --form-string "text=⚠️ Бэкап БД не удался ($(hostname), $(date -u '+%F %H:%M') UTC, строка $1). Подробности: journalctl -u kopeechka-backup" ||
    true
}
trap 'on_error $LINENO' ERR

install -d -m 700 "$BACKUP_DIR"
rm -f "$BACKUP_DIR"/*.part
file="$BACKUP_DIR/kopeechka_$(date -u +%Y%m%d_%H%M%S).dump"
runuser -u postgres -- pg_dump -Fc "$DB_NAME" >"$file.part"
pg_restore --list "$file.part" >/dev/null # архив читается целиком, оглавление на месте
mv "$file.part" "$file"
echo "Бэкап: $file ($(du -h "$file" | cut -f1))"

# Ротация: имена с датой, самые новые — первые.
ls -1t "$BACKUP_DIR"/kopeechka_*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f --

if [[ ${1:-} == "--send" || $(date -u +%u) == 7 ]]; then
  enc="$(mktemp)"
  trap 'rm -f "$enc"' EXIT
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$PASS_FILE" \
    --symmetric --cipher-algo AES256 --output "$enc" "$file"
  name="$(basename "$file").gpg"
  if (($(stat -c %s "$enc") > TG_LIMIT_BYTES)); then
    telegram sendMessage --form-string "chat_id=$ADMIN_ID" \
      --form-string "text=⚠️ Копия БД $name больше 45 МБ и в Telegram не отправлена. Пора переносить бэкапы в Object Storage."
  else
    telegram sendDocument --form-string "chat_id=$ADMIN_ID" -F "document=@$enc;filename=$name" \
      --form-string "caption=🗄 Еженедельная копия БД ($(du -h "$file" | cut -f1)). Зашифрована, расшифровка — DEPLOY.md, «Резервная копия БД»."
  fi
  echo "Копия отправлена администратору: $name"
fi
