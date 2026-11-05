#!/usr/bin/env bash
# Проверка бэкапа восстановлением (MKB-044). Запуск на ноутбуке из Git Bash:
#   bash deploy/backup/verify-restore.sh <kopeechka_*.dump | kopeechka_*.dump.gpg>
# .gpg расшифровывается паролем из $PASS_FILE. Дамп восстанавливается в одноразовый контейнер Postgres
# (локальная БД разработки не трогается), печатается число строк в каждой таблице, контейнер удаляется.
set -Eeuo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash не должен переписывать аргументы docker как пути Windows

src="${1:?Укажите файл: kopeechka_*.dump или kopeechka_*.dump.gpg}"
PASS_FILE="${PASS_FILE:-$HOME/.kopeechka/backup.pass}"
IMAGE="${IMAGE:-postgres:latest}" # pg_restore должен быть не старше Postgres на сервере (18)
name="kopeechka-restore-check-$$"

trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" -e POSTGRES_PASSWORD=check -e POSTGRES_DB=restore_check "$IMAGE" >/dev/null
# По TCP сервер отвечает только после инициализации (временный сервер init слушает лишь сокет).
for _ in $(seq 60); do
  docker exec "$name" pg_isready -q -h 127.0.0.1 -U postgres && break
  sleep 1
done

restore() { docker exec -i "$name" pg_restore --no-owner --no-privileges --exit-on-error -U postgres -d restore_check; }
if [[ $src == *.gpg ]]; then
  gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$PASS_FILE" --decrypt "$src" | restore
else
  restore <"$src"
fi

counts="$(docker exec "$name" psql -U postgres -d restore_check -At -F ' ' -c "
  SELECT table_name,
         (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name")"
echo "Строк в таблицах:"
echo "$counts"
if ! grep -qE '^transactions [1-9]' <<<"$counts"; then
  echo "Ошибка: в восстановленной БД нет операций (transactions пуста или отсутствует)" >&2
  exit 1
fi
echo "OK: бэкап восстанавливается, операции на месте."
