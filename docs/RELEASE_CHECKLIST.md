# Release checklist (MKB-016, обновлён в MKB-046)

Один Node-процесс: grammY-бот (long polling) и Nest (`/api` + раздача `webapp/dist`) на `127.0.0.1:3000`
за Caddy. Продакшн — сервер Oracle Cloud (`DEPLOY.md`). CI (`.github/workflows/ci.yml`) гоняет
`npm run check` для бота и webapp на каждый PR и push в `main`.

## Перед релизом

1. CI зелёный, PR слит в `main`; локально `git pull --ff-only`, рабочая копия чистая.
2. Просмотреть `git log` со времени последнего релиза (`ssh ... "cat ~/bot/RELEASE"` — что сейчас на сервере):
   какие тикеты вошли, есть ли новые файлы в `sql/`.
3. Новые миграции — прогнать `npm run migrate:up` на локальной/одноразовой БД **дважды**: на чистой и повторно
   (все миграции идемпотентны: `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).

## Выкладка

1. `.\scripts\deploy.ps1` — сборка webapp и бота, `npm run check`, загрузка, сохранение предыдущей версии,
   бэкап и миграции (только если `sql/` изменился), перезапуск, проверка `is-active`. Подробно — `DEPLOY.md`.
2. Если миграция упала — скрипт останавливается до перезапуска (старый процесс продолжает работать на
   прежнем коде). Разбираться, почему файл перестал быть идемпотентным; не применять «руками» и не игнорировать.
3. Если бот не поднялся — `.\scripts\rollback.ps1`.
4. Смоук-проверка (ниже) под своим аккаунтом, `/health` — БД отвечает, курсы не «устаревший».
   Ошибки после релиза придут админу в Telegram (MKB-045).

## Смоук-проверка после релиза

Бот:
- `/start` → главное меню с кнопками.
- Быстрый ввод: `25 GEL тест` → категория → сохранение → остаток и кнопка «Отменить» → отменить.
- `/today`, `/month` → суммы совпадают со здравым смыслом, под ответом кнопки меню.
- `📋 Дашборд`, `📈 Статистика`, `📉 Тренд` → открываются, переключение периода работает.
- `/settings` → смена валюты отображения и часового пояса, `/settings reset`.
- `/payments`, `/goal` → списки открываются, пауза/возобновление платежа работает.

Мини-приложение (кнопка «Копеечка» у поля ввода):
- Открывается без ошибки, «Сегодня можно потратить» показывает число и кольцо дня.
- Чип частой категории → сумма → «Сохранить» → тост «Отменить» → операция в «Последних операциях»; тап по ней →
  правка суммы → сохранить → удалить.
- «Бюджет» (Траты / Лимиты), «Цели» (Копить / Гасить долги), «Профиль» открываются.

Визуальная проверка (MKB-055) — при изменениях в `webapp/`:
- Ширины 320, 360, 390 и 430 px: нет горизонтальной прокрутки, суммы не разрываются со знаком валюты,
  подписи вкладок в одну строку.
- Светлая и тёмная тема Telegram (и тёмная вне Telegram): текст подсказок читается — цвет подсказок сдвинут к
  цвету текста, контраст от 4,5:1 (проверено для тем iOS, Android, Desktop).
- Зоны нажатия не меньше 44 px по высоте (кнопки, «Подробнее», галочки, выбор в списках).
- Цвета только через токены: `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" webapp/src --include=*.css | grep -v tokens.css` — пусто.
- Android и iOS-клиент Telegram — хотя бы по одному живому открытию перед выкладкой большого изменения дизайна.

## Откат

- Код: `.\scripts\rollback.ps1` (хранится один предыдущий релиз).
- Данные: восстановить дамп (`DEPLOY.md`, «Резервная копия БД») — перед каждой миграцией deploy делает свежий.
- Миграции по одной откатываются только вручную и только в крайнем случае:

| Файл | Откат |
| --- | --- |
| `schema.sql` | `DROP TABLE transactions` — уничтожает все операции, только для полностью пустой БД |
| `002_add_rate_cache.sql` | `DROP TABLE rate_cache` |
| `003_recurring.sql` | `DROP TABLE recurring` — таблица уже не используется кодом (см. коммит с удалением `src/recurring.ts`) |
| `003_release_0_0_8.sql` | `DROP TABLE categories, budgets, recurring_payments, savings_goals` |
| `004_categories_rules.sql` | `ALTER TABLE categories DROP COLUMN kind; ALTER TABLE budgets DROP COLUMN rollover` |
| `005_savings_goal_target_date.sql` | `ALTER TABLE savings_goals DROP COLUMN target_date` |
| `006_user_settings.sql` | `DROP TABLE user_settings` |
| `007_debts.sql` | `DROP TABLE debts` |
| `008_month_plan.sql` | `DROP TABLE income_sources, income_receipts, planned_expenses; ALTER TABLE user_settings DROP COLUMN exchange_factor, DROP COLUMN onboarded_at` |
| `009_progress.sql` | `DROP TABLE user_achievements, user_progress` |
| `010_events.sql` | `DROP TABLE events` |
| `011_evening_reminder.sql` | `ALTER TABLE user_settings DROP COLUMN remind_evening, DROP COLUMN remind_hour, DROP COLUMN evening_notified` |

## Известные ограничения

- Нет staging-окружения и тестовой БД в CI (см. `docs/SECURITY_AUDIT.md`) — код, работающий с БД,
  проверяется вручную и по смоук-чек-листу.
- Хранится только одна предыдущая версия кода на сервере; более старую — собрать из git и выложить.
