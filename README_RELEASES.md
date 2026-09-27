# Kopeechka Bot — releases 0.0.1–0.0.8

This source tree extends the supplied 0.0.1 project with the feature set planned through 0.0.8.

## Release map
- **0.0.2** — currency rate cache and conversion (existing project files/migration).
- **0.0.3** — persistent main reply keyboard, menu routes, confirmation/cancel for quick transaction entry.
- **0.0.4** — personal categories and budget limits (`/category`, `/budget`).
- **0.0.5** — recurring-payment registry (`/payment`, `/payments`, `/deletepayment`).
- **0.0.6** — savings goals and contributions (`/goal`, `/save`, `/deletegoal`).
- **0.0.7** — monthly category analytics (`/stats`) and recent history.
- **0.0.8** — CSV export (`/export`) and consolidated menu/help.

## Apply database changes
Run the existing `sql/schema.sql`, then `sql/002_add_rate_cache.sql`, then `sql/003_release_0_0_8.sql` against the database configured in `DATABASE_URL`.

## Commands added
- `/menu`
- `/category expense|income NAME`
- `/budget [CATEGORY AMOUNT]` — view current-month budget, or set/update a category limit in GEL.
- `/payment DAY AMOUNT CURRENCY TITLE` — create a recurring payment; `/payments` list; `/deletepayment ID` deactivate.
- `/goal TITLE TARGET_GEL` — create; `/goal` list; `/save GOAL_ID AMOUNT_GEL` contribute; `/deletegoal ID` close.
- `/stats` — current-month expenses by category.
- `/export` — CSV of up to 5,000 latest transactions.

## Notes / known limitations
- Recurring payments are stored and listed, but automated scheduled reminders and automatic transaction posting are not yet enabled. This avoids sending duplicate reminders without a persistent scheduler/notification ledger.
- Transaction-entry wizard state is in memory and is cleared on restart. Existing one-line entry remains supported.
- Budget amounts and savings contributions are denominated in GEL. Category budgets compare converted `amount_gel`; transactions without a rate are not included in totals.
- All SQL queries for user-owned records are scoped by Telegram user ID. Do not expose the bot token or `.env`.
