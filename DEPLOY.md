# DEPLOY

> Репозиторий публичный: реальные IP, домен и путь к SSH-ключу вынесены в локальный `DEPLOY.local.md`
> (в git его нет). Плейсхолдеры `<SERVER_IP>`, `<SERVER_DOMAIN>`, `<SSH_KEY>` ниже подставляйте оттуда.

Порядок выкладки (общий) — в `docs/RELEASE_CHECKLIST.md`. Продакшн работает на сервере Oracle Cloud
(см. ниже), а не на ноутбуке.

## Продакшн-сервер (Oracle Cloud Always Free)

| | |
|---|---|
| Регион | Germany Central (Frankfurt), тенант `tribls` |
| Машина | `VM.Standard.E2.1.Micro` (AMD, 1 ГБ RAM), Ubuntu 24.04, + swap 2 ГБ (`/swapfile`) |
| Публичный IP | `<SERVER_IP>` — **Reserved** (не меняется при перезапуске машины) |
| Мини-приложение | `https://<SERVER_DOMAIN>` (sslip.io — бесплатный wildcard-DNS, сертификат Let's Encrypt выдаёт Caddy сам) |
| SSH | `ssh -i <SSH_KEY> ubuntu@<SERVER_IP>` (приватный ключ — только у владельца, в репозиторий не класть) |

Что стоит на сервере:

- **Бот** — служба systemd `kopeechka` (`/etc/systemd/system/kopeechka.service`):
  `node dist/index.js` из `/home/ubuntu/bot`, `Restart=always` (подхватывает и кнопку «Перезапуск», код выхода 75),
  автозапуск при загрузке. Логи: `sudo journalctl -u kopeechka -f`.
- **Postgres 18** (репозиторий PGDG), БД `My_KopeechkaBot`, роль `kbot`. Пароль — только в `/home/ubuntu/bot/.env`
  (`DATABASE_URL`, права 600). Данные перенесены `pg_dump -Fc` из локального Docker-контейнера `my-postgres`.
- **Caddy** — `/etc/caddy/Caddyfile`: `<SERVER_DOMAIN> { reverse_proxy 127.0.0.1:3000 }`.
  Nest слушает только `127.0.0.1:3000` (раздаёт `webapp/dist` и `/api`), наружу смотрит один Caddy.
- **`.env`** на сервере: `BOT_TOKEN`, `ADMIN_TELEGRAM_ID`, `DATABASE_URL` (локальный Postgres сервера),
  `WEBAPP_URL=https://<SERVER_DOMAIN>`.
- **Сеть**: security list VCN открыт на 22 (SSH), 80 и 443 (TCP, `0.0.0.0/0`). В Oracle-образе Ubuntu есть ещё
  iptables-правила — 80/443 разрешены **выше** правила `REJECT` и сохранены через `netfilter-persistent`.

> Один бот-токен — один процесс. Не запускайте локально `npm start` с продакшн-токеном: Telegram вернёт
> `409 Conflict` и положит оба процесса. Для разработки — отдельный тестовый бот и своя БД.

## Выкладка изменений на сервер

На сервере нет исходников и dev-зависимостей (1 ГБ RAM не тянет сборку) — собираем локально и заливаем
готовый `dist`.

Одной командой (MKB-046), PowerShell из корня репозитория; сервер и ключ скрипт берёт из `DEPLOY.local.md`:

```powershell
.\scripts\deploy.ps1      # выкладка
.\scripts\rollback.ps1    # откат на предыдущий релиз
```

Что делает `deploy.ps1`:
1. Отказывается работать с незакоммиченными изменениями (на сервер уходит рабочая копия; обойти — `-AllowDirty`).
2. Собирает `webapp/dist` (`npm --prefix webapp run build`), гоняет `npm run check`, собирает `dist`.
3. Пакует `dist webapp/dist package.json package-lock.json sql` и файл `RELEASE` (коммит, ветка, время),
   заливает вместе с `deploy/release/install-release.sh` и запускает его на сервере.
4. На сервере текущая версия переименовывается в `*.prev` (хранится одна), ставится новая,
   `npm ci --omit=dev --ignore-scripts` (`husky` нет в prod-зависимостях).
5. **Если `sql/` изменился** — сначала `sudo kopeechka-backup --send` (бэкап + копия админу), затем миграции
   по порядку (`schema.sql`, потом `NNN_*.sql`) от `postgres` — таблицы принадлежат ему, `kbot` не может их `ALTER`.
6. Перезапуск и проверка `systemctl is-active`; если служба не поднялась — код ошибки, журнал и подсказка про откат.

`rollback.ps1` возвращает `*.prev`, ставит его зависимости и перезапускает бота. Миграции не откатываются:
они только добавляют таблицы и колонки, предыдущий код их не замечает. Какой релиз сейчас на сервере:
`ssh ... "cat ~/bot/RELEASE"`.

- Смена `.env` на сервере: `nano ~/bot/.env`, затем `sudo systemctl restart kopeechka`.

## Резервная копия БД (MKB-044)

Автоматически, файлы — в `deploy/backup/`:

- **Каждый день в 01:30 UTC** таймер `kopeechka-backup.timer` запускает `/usr/local/bin/kopeechka-backup` (от root):
  `pg_dump -Fc` в `/var/backups/kopeechka/kopeechka_<дата>.dump` (папка `700`), хранятся **14** последних копий.
  Пропущенный запуск (машина была выключена) выполняется сразу после загрузки.
- **По воскресеньям** свежая копия шифруется `gpg` (AES256) и приходит администратору (`ADMIN_TELEGRAM_ID`) в Telegram
  файлом `kopeechka_<дата>.dump.gpg` — это копия вне сервера на случай потери самой машины.
- **При ошибке** администратору приходит сообщение «⚠️ Бэкап БД не удался», подробности — `sudo journalctl -u kopeechka-backup`.
- Пароль шифрования: на сервере `/etc/kopeechka/backup.pass` (root, `600`), у владельца — `%USERPROFILE%\.kopeechka\backup.pass`
  **и в менеджере паролей**. Без пароля копии из Telegram не расшифровать.

Установка или обновление (из корня репозитория, Git Bash; пароль берётся из локального файла):

```bash
k="<SSH_KEY>"; s=ubuntu@<SERVER_IP>
scp -i "$k" deploy/backup/kopeechka-backup.{sh,service,timer} ~/.kopeechka/backup.pass "$s":/tmp/
ssh -i "$k" "$s" 'cd /tmp && sudo install -m 755 kopeechka-backup.sh /usr/local/bin/kopeechka-backup \
  && sudo install -m 644 kopeechka-backup.service kopeechka-backup.timer /etc/systemd/system/ \
  && sudo install -d -m 700 /etc/kopeechka && sudo install -m 600 backup.pass /etc/kopeechka/backup.pass \
  && rm -f kopeechka-backup.* backup.pass && sudo systemctl daemon-reload \
  && sudo systemctl enable --now kopeechka-backup.timer && systemctl list-timers kopeechka-backup.timer --no-pager'
```

Ручной запуск с отправкой копии в Telegram (например, перед миграцией): `sudo kopeechka-backup --send`.

Проверка восстановлением — на ноутбуке, в одноразовом Docker-контейнере (локальная БД разработки не трогается):

```bash
bash deploy/backup/verify-restore.sh ~/Downloads/kopeechka_20261108_013000.dump.gpg
```

Печатает число строк в каждой таблице и `OK`, если операции на месте. Свежую копию без ожидания воскресенья можно
скачать с сервера: `ssh -i "$k" "$s" 'sudo cat "$(ls -1t /var/backups/kopeechka/*.dump | head -1)"' > latest.dump`
(в Git Bash — в PowerShell `>` портит бинарные файлы).

Восстановление на сервере: `sudo -u postgres pg_restore --clean --if-exists --no-owner --no-privileges -d My_KopeechkaBot <файл.dump>`
(перед этим `sudo systemctl stop kopeechka`; `.gpg` сначала расшифровать:
`gpg --batch --pinentry-mode loopback --passphrase-file <пароль> -o файл.dump -d файл.dump.gpg`).

## Мониторинг (MKB-045)

- **Алерты в Telegram.** Любая ошибка из хендлеров бота, планировщиков и непредвиденная ошибка API (500)
  приходит на `ADMIN_TELEGRAM_ID` сообщением «⚠️ Ошибка в боте» — не чаще одного на тип ошибки за 10 минут,
  повторы считаются и упоминаются в следующем. Без `ADMIN_TELEGRAM_ID` алерты выключены (в логе — WARN).
- **Сводка в 9:00** по часовому поясу администратора (из его настроек): аптайм, память, БД, курсы,
  активные пользователи за сутки и неделю, ошибки за сутки по типам.
- **Внешний пинг** — если упал весь сервер, бот ничего не пришлёт. Настраивается один раз вручную:
  бесплатный монитор (например, UptimeRobot, тип HTTP(s), интервал 5 минут) на
  `https://<SERVER_DOMAIN>/api/health` (отвечает `{"ok":true}`, проверяет и БД), уведомления — на почту или в Telegram.

## Если поменялся публичный IP

Адрес мини-приложения построен на IP (`<ip-через-дефисы>.sslip.io`). Если IP сменится (например, машину
пересоздали): поправьте домен в `/etc/caddy/Caddyfile` и `WEBAPP_URL` в `~/bot/.env`, затем
`sudo systemctl restart caddy kopeechka`. Постоянный IP в Oracle — только через **Reserved public IP**
(Instance → VNIC → IP administration → Edit → Reserved public IP). Временный (ephemeral) в зарезервированный
не превращается: сначала снимается, затем назначается новый — адрес меняется.

## graphify

`graphify-out/` (граф знаний кода для Claude Code) — локальный артефакт разработки:
добавлен в `.gitignore`, **не** деплоится и не нужен на сервере. Пересборка локально:
`graphify extract . --code-only`.
