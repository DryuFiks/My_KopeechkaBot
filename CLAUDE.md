# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal-finance Telegram bot (grammY + TypeScript + PostgreSQL via raw `pg`, no ORM). Single
Node process, long-polling, no HTTP server. `README.md`/`README_RELEASES.md` are stale (describe
the pre-Sprint-1 MVP state) — do not treat them as authoritative; this file and `docs/` reflect the
current implementation (roadmap Sprints 1–4, tickets MKB-004…MKB-016, all implemented).

## Commands

```bash
npm run dev              # tsx watch src/index.ts — local development
npm run build             # tsc — must pass before commit (Husky pre-commit runs this)
npm start                 # node dist/index.js — run the built bot
npm run format             # prettier --write
npm run format:check       # prettier --check (pre-commit / check)
npm run lint                # eslint . (max-lines: 300 on every src/**/*.ts — see below)
npm test                    # vitest run — all tests
npx vitest run src/foo.test.ts   # a single test file
npm run check                 # format:check && lint && build && test — run this before considering any change done
npm run migrate:create -- <name>   # scaffolds sql/NNN_<name>.sql with the next number
npm run migrate:up                  # applies every sql/*.sql against DATABASE_URL, in order
```

**Production runs on Oracle Cloud (Always Free VM, Frankfurt), not on the laptop** — see
`DEPLOY.md` for the server layout and the update procedure. The "🔄 Перезапуск" ("Restart") button
(`action:restart`, admin-only via `ADMIN_TELEGRAM_ID`) exits with code 75; on the server systemd
(`Restart=always`) brings the bot back up, locally `start.bat` does the same (use it instead of
`npm start` on Windows). Always `npm run build` after pulling changes before restarting.

**Never run a second instance with the production `BOT_TOKEN`.** Telegram allows one `getUpdates`
poller per bot: a local `npm start` next to the server one kills both with `409 Conflict`. For
local development use a separate test bot token and a separate database.

## Database / migrations

No migration framework, no tracking table. `sql/*.sql` files are applied in order (`schema.sql`
first, then by `NNN_` numeric prefix) by `scripts/migrate.ts`, and **every file is re-applied on
every run** — there is nothing that records "already applied". This is only safe because every
migration is written idempotently (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`). Any new migration must follow the same rule or `migrate:up` will
fail the second time it runs. See `docs/RELEASE_CHECKLIST.md` for the release/rollback process.

The `recurring` table (from `sql/003_recurring.sql`) still exists in the DB but has **zero**
application code referencing it — it was a dead auto-posting engine that got deleted because it
conflicted with MKB-012's "a reminder is never a transaction" rule. Use `recurring_payments`
(`src/db/payments.ts`) instead; do not resurrect `src/recurring.ts`.

## Architecture

### Bot startup (`src/index.ts`)
`checkConnection()` → `loadRateCacheFromDb()` + `refreshRatesIfStale()` → register handlers (order
below) → `startPaymentReminders(bot)` (hourly `setInterval`, see `src/reminders.ts`) → `bot.start()`.

### Handler registration layers
1. `src/handlers.ts` — plain commands (`/start /help /today /month /last /undo /rate`).
2. `src/handlers/navigation.ts` — `menu:<section>` callbacks (top-level menu navigation).
3. `src/handlers/menuActions.ts` — `action:<name>` callbacks (section actions: budget, history,
   rates, restart, ...).
4. `src/features.ts` → each `features/*.ts` registers its own commands **and** its own callbacks
   (e.g. `features/payments.ts` owns both `/payment` and `paypause:<id>`/`delpay:*`/`payrem:*`).
5. `src/handlers/textFlow.ts` — the **single** `message:text` handler (drives the add-transaction
   wizard) plus `flow:*`/`cat:*`/`undo:*` callbacks. Registered last, but registration order among
   filtered handlers (`bot.command`/`bot.callbackQuery`) doesn't matter: grammY auto-chains to the
   next middleware whenever a filter doesn't match, so only genuinely competing handlers on the
   *same* filter would need ordering — don't add a second `message:text` handler; route new
   text-input scenarios through the existing `Flow` state machine instead.

Every callback handler should go through `safe`/`safeCallback` (`src/middleware/safe.ts`): they
classify errors (user input vs. transient DB vs. internal — never leak raw error text to the user)
and guarantee `answerCallbackQuery` fires exactly once, even on exception.

### The Flow wizard
`features/common.ts` holds `flows: Map<userId, Flow>` — in-memory, per-user, lost on restart. Text
messages check this map first (`textFlow.ts`); no active flow falls back to the classic one-line
`-150 gel еда обед` parser (`parser.ts`). When saving a flow, delete it from the map **synchronously,
before the first `await`** — this closes the double-tap/duplicate-update race window (see the
`flow:save` handler for the pattern; the same idempotency approach is used for `payrem:record` via
a plain `Set<number>` guard in `features/payments.ts`).

### Timezone and display-currency: presentation-only, never storage
Transactions and every aggregate are always stored/summed in **GEL**. Two independent user
preferences (`src/db/settings.ts`, lazy row — defaults in code until the user actually changes
something) only affect *rendering*:
- **Timezone** — `src/timezone.ts` (`zonedDayBoundaries`, `zonedMonthBoundaries`, `zonedToday`,
  `zonedDateBoundary`) is the *only* correct way to compute a day/month boundary for a user. Never
  construct boundaries with local `new Date(y, m, d)` in handler code — that's the server's
  timezone, not the user's. `period.ts` (dashboard/trend/stats periods) and payment due-day checks
  both go through this.
- **Display currency** — `src/displayCurrency.ts`'s `toDisplayCurrency` converts a GEL amount for
  showing on screen only (`/today`, `/month`, the dashboard); falls back to GEL with a note if the
  target currency's rate is unavailable (never invents a number). Budget/stats/trend screens stay
  GEL-only by design (limits are set in GEL).

### Pure-module split (important for testability)
`src/db.ts` imports `pg` and throws at import time if `DATABASE_URL` is unset — so does anything
that imports `db.ts`, transitively (`currency.ts` does, via the rate cache). Several modules were
deliberately split out so their logic can be unit-tested without a DB or `.env`:
`currencies.ts` (currency codes + `convertAmountBetween`), `paymentDueCheck.ts`
(`isPaymentDueToday`), `timezone.ts`, `period.ts`, `charts.ts`, `budgetRules.ts`, `format.ts`,
`parser.ts`. **When adding new business logic, put the pure/decidable part in a DB-free module and
only the I/O shell in something that imports `db.ts`** — otherwise its test file will fail with
`DATABASE_URL is not set` even though the logic itself needs no database.

There is no test database; DB-touching code (queries, callback handlers) is verified manually, not
by automated tests — see `docs/SECURITY_AUDIT.md` for what's covered by code review instead
(per-user isolation, idempotency) and `docs/RELEASE_CHECKLIST.md` for the manual smoke checklist.

### File-name collisions are intentional
`db.ts` + `db/`, `keyboards.ts` + `keyboards/`, `handlers.ts` + `handlers/` all coexist. TypeScript
resolves `./db` / `./keyboards` / `./handlers` to the `.ts` file (not the directory's index) —
this is the established pattern for "one well-known top-level export set, plus a growing folder of
more specific sub-modules"; follow it rather than merging things into the flat file.

### Formatting layer
`src/format.ts` holds every "turn data into the exact text Telegram shows" pure function
(`formatMoney`, `formatSignedAmount`, `formatPeriodLabel`, `renderScreen`, `formatBudgetCategoryLine`,
`formatGoalProgress`, `formatDelta`/`formatPercentDelta`, `paginate`, ...). Reuse these instead of
building ad hoc strings — they encode house rules (2-decimal money, HTML-escaping via
`escapeHtml`, "never show a bare list, always an emptyText", capped percentages, "н/д" ("n/a") instead of
`Infinity`/`NaN`). `src/charts.ts` holds the text/emoji chart renderers (bars, share lists,
sparklines) on the same no-I/O basis.

`src/editOrReply.ts` — shared "edit the callback's message, or send a fresh reply if the edit
fails" helper. **Always pass an explicit `reply_markup`, even an empty `InlineKeyboard()`**, on a
terminal screen: Telegram does not clear a message's inline keyboard just because
`editMessageText` omitted `reply_markup` — the old buttons stay live and tappable otherwise.
`keyboards.ts`'s `withMainMenuRows`/`undoKeyboard` show the pattern for "terminal screen must still
offer a next action".

### Callback-data conventions
`menu:<section>` (top nav) · `action:<name>` (section actions) · `flow:save|cancel` (wizard) ·
`cat:<index>|none` (category picker — index into `Flow.categoryOptions`, never the raw name, to
stay under Telegram's 64-byte callback_data limit) · `undo:<txId>` · `<prefix>:<id>:yes|no`
(`confirmActionKeyboard`, for irreversible actions) · `<prefix>:<page>` (pagination) ·
`dash:<unit>:<offset>` / `trend:<unit>:<offset>` (period switchers, `keyboards/period.ts`) ·
`stats:<offset>` / `stat_drill:<offset>:<index>:<page>` · `paypause:<id>` / `payrem:<id>:record|skip`
· `settings:currency:<CUR>` / `settings:notify:toggle` / `settings:reset`.

Every id-bearing callback resolves its row with `WHERE id=$1 AND user_id=$2` (never a bare
`WHERE id=$1`) — treat 0 rows back as "already done", not an error (see `docs/SECURITY_AUDIT.md`'s
idempotency table for the full list). Admin-only actions (`action:restart`, `/health`) gate on
`Number(process.env.ADMIN_TELEGRAM_ID) === ctx.from.id`.

### Lint constraint
`eslint.config.mjs` sets `max-lines: 300` (error) on every `src/**/*.ts`. When a file approaches
it, split by concern into a sibling module rather than disabling the rule — e.g. `db/budget.ts`,
`db/payments.ts`, `db/goals.ts`, `db/settings.ts` were all split out of a growing `db.ts` this way.

## Docs

- `docs/RELEASE_CHECKLIST.md` — release steps, migration rollback table, manual smoke checklist.
- `docs/SECURITY_AUDIT.md` — per-user isolation audit, idempotency table, what's covered by tests
  vs. code review vs. manual checking.

## Environment (`.env`, gitignored — see `.env.example`)
`BOT_TOKEN`, `DATABASE_URL`, `ADMIN_TELEGRAM_ID` (numeric Telegram user id for admin-only actions).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Commit message rule
At the end of every task that changed files (and in each new session), print a commit message:

```
[TASK-KEY]: short description
- path/to/file — what changed   (one line per file)

Summary: 1–2 sentences.
```

## Apply changes yourself
After any fix or migration, apply it right away so the user only has to start the bot:
`npm run migrate:up` (if `sql/` changed) → `npm run build` → `npm run check`. Report the results; do not leave these steps for the user.
Note: local `migrate:up` hits the *local* Docker database (`my-postgres`); the production DB is on
the Oracle server — deploying a change there is the procedure in `DEPLOY.md` (only on the user's request).

## Deploying to production (only when the user asks: «выкати», «задеплой»)
The server has no sources and no dev dependencies — build locally, upload the built output.
Full details/layout: `DEPLOY.md`. The repo is public, so the real IP / domain / SSH key path are
placeholders (`<SERVER_IP>`, `<SERVER_DOMAIN>`, `<SSH_KEY>`) — take the values from the local,
git-ignored `DEPLOY.local.md` (or ask the user). Steps, in this order:

1. `git pull --ff-only` if the user says there are new changes in `origin/main` (other branches/PRs
   land there; they may not pass `format:check` — fix with `npx prettier --write <files>` and commit).
2. **Build the web app separately: `(cd webapp && npm run build)`.** The root `npm run build` is only
   `tsc` for the bot and does **not** rebuild `webapp/dist` — skipping this ships a stale frontend.
3. `npm run check` (format, lint, tsc, tests) and `npm run build` for the bot's `dist/`.
4. Commit and `git push` (commit/push only on the user's request; deploy uploads the working tree's
   build, so commit first to keep the repo and the server in step).
5. Upload and restart (PowerShell, from the repo root; key path is in `DEPLOY.md`):
   ```powershell
   $k="<SSH_KEY>"
   tar -czf $env:TEMP\app.tgz dist webapp/dist package.json package-lock.json sql
   scp -i $k $env:TEMP\app.tgz ubuntu@<SERVER_IP>:/tmp/
   ssh -i $k ubuntu@<SERVER_IP> "cd ~/bot && rm -rf webapp/dist && tar -xzf /tmp/app.tgz && npm ci --omit=dev --ignore-scripts >/dev/null 2>&1; rm /tmp/app.tgz && sudo systemctl restart kopeechka && sleep 3 && systemctl is-active kopeechka && sudo journalctl -u kopeechka -n 5 --no-pager"
   ```
   (`rm -rf webapp/dist` first so deleted/renamed hashed assets don't pile up; `--ignore-scripts` is
   required — `husky` isn't in prod deps.)
6. If `sql/` gained a new migration, apply it **on the server** (`tsx` isn't there, so not
   `migrate:up`) — the exact `psql` loop is in `DEPLOY.md` ("Миграции"). Do this *before* the restart.
7. Verify: `is-active` prints `active` and the journal shows `Bot is running.` / `HTTP listening`.
   Never run a second bot instance locally with the production token (409 Conflict).
