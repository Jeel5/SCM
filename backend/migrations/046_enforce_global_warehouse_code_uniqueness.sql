-- Enforce global uniqueness for warehouse codes across all organizations.
-- Keeps existing (organization_id, code) constraint for same-org UPSERT behavior,
-- and adds a global unique index to block cross-org duplicates.
--
-- Existing duplicate codes across organizations are auto-normalized by appending
-- an organization-specific suffix so migration remains one-shot and idempotent.

WITH duplicate_codes AS (
  SELECT lower(btrim(code)) AS normalized_code
  FROM warehouses
  WHERE code IS NOT NULL AND btrim(code) <> ''
  GROUP BY lower(btrim(code))
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT
    w.id,
    w.organization_id,
    btrim(w.code) AS original_code,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(w.code))
      ORDER BY w.organization_id, w.id
    ) AS rn
  FROM warehouses w
  JOIN duplicate_codes d
    ON d.normalized_code = lower(btrim(w.code))
),
renamed AS (
  SELECT
    r.id,
    CASE
      WHEN r.rn = 1 THEN r.original_code
      WHEN r.rn = 2 THEN r.original_code || '-' || upper(substr(replace(r.organization_id::text, '-', ''), 1, 4))
      ELSE r.original_code || '-' || upper(substr(replace(r.organization_id::text, '-', ''), 1, 4)) || '-' || (r.rn - 1)::text
    END AS new_code
  FROM ranked r
  WHERE r.rn > 1
)
UPDATE warehouses w
SET code = renamed.new_code,
    updated_at = NOW()
FROM renamed
WHERE w.id = renamed.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouses_code_idx
  ON warehouses (lower(btrim(code)))
  WHERE code IS NOT NULL AND btrim(code) <> '';
