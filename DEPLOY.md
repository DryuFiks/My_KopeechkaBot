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

```powershell
# 1. локально: проверки и сборка (webapp/dist собирается вместе с проектом)
npm run check
npm run build

# 2. упаковать и залить (из корня репозитория)
tar -czf $env:TEMP\app.tgz dist webapp/dist package.json package-lock.json sql
scp -i <SSH_KEY> $env:TEMP\app.tgz ubuntu@<SERVER_IP>:/tmp/

# 3. на сервере: распаковать, (при смене зависимостей) поставить, перезапустить
ssh -i <SSH_KEY> ubuntu@<SERVER_IP> `
  "cd ~/bot && tar -xzf /tmp/app.tgz && npm ci --omit=dev --ignore-scripts && rm /tmp/app.tgz && sudo systemctl restart kopeechka && systemctl is-active kopeechka"
```

- `--ignore-scripts` обязателен: `prepare` запускает `husky`, которого нет в prod-зависимостях.
- **Миграции** на сервере (`tsx` — dev-зависимость, `migrate:up` там не работает). Все файлы идемпотентны,
  применяются по порядку — `schema.sql`, затем `NNN_*.sql`:
  `cd ~/bot && for f in sql/schema.sql $(ls sql/0*.sql | sort); do sudo -u postgres psql -d My_KopeechkaBot -v ON_ERROR_STOP=1 -f $f; done`
  (от `postgres`, а не `kbot`: таблицы созданы владельцем `postgres`, `kbot` имеет на них права, но не может их `ALTER`).
- Смена `.env` на сервере: `nano ~/bot/.env`, затем `sudo systemctl restart kopeechka`.
- Откат: старый `dist` не хранится — при необходимости откатитесь в git, соберите и залейте по шагам выше.

## Резервная копия БД

```powershell
ssh -i <SSH_KEY> ubuntu@<SERVER_IP> `
  "sudo -u postgres pg_dump -Fc My_KopeechkaBot" > backup.dump
```

Восстановление: `pg_restore --no-owner --no-privileges -d My_KopeechkaBot backup.dump` (под пользователем `postgres`).
Автоматических бэкапов пока нет.

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
