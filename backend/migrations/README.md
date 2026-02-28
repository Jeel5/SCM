# Database Migrations

## Current State (as of 2026-02-27)

The live database is fully captured in **`/init.sql`** (root) plus all migrations in
`archive/` up to and including `022_carrier_capacity.sql`.

This was verified against `dump-scm_db-202602271335.sql`.

---

## Pending Migrations

Run these in order against the current database:

| # | File | What it does |
|---|------|--------------|
| 1 | `023_carrier_api_timeout.sql` | Adds `api_timeout_ms INTEGER` column to `carriers` table. Allows per-carrier HTTP timeout instead of a global env-var default. |
| 2 | `024_postal_zones_stub.sql` | Creates empty `postal_zones` and `zone_distances` tables for future zone-based shipping logic (currently placeholder — must be seeded before use). |

### Running the pending migrations

```bash
# From repo root or the machine with psql access:
psql -U postgres -d scm_db -f backend/migrations/023_carrier_api_timeout.sql
psql -U postgres -d scm_db -f backend/migrations/024_postal_zones_stub.sql
```

Both files use `IF NOT EXISTS` / idempotent DDL so they are safe to re-run.

---

## Archive

`migrations/archive/` holds all previously applied migration files (004–022), kept for
historical reference. **Do not run these again** — all their changes are already in the
database.

The files were originally numbered with overlapping prefixes (multiple `005_*`, `006_*`, etc.)
due to parallel development. The archive preserves the original names for traceability.

---

## Adding a new migration

1. Pick the next sequential number: currently **025**.
2. Name it `025_<short_description>.sql`.
3. Write idempotent DDL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, etc.).
4. Add a row to this README's Pending Migrations table above.
5. After applying it to the database, move the file to `archive/`.
