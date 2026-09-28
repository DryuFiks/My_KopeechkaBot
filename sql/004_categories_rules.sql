-- MKB-011: categories carry a "kind" (recurring/variable/irregular) so reports can
-- group by spending pattern; budgets can opt into rolling an unspent balance forward.
-- Run this after sql/003_release_0_0_8.sql.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'variable'
    CHECK (kind IN ('recurring', 'variable', 'irregular'));

ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS rollover BOOLEAN NOT NULL DEFAULT FALSE;
