#!/bin/bash

# Load environment variables
set -a
source /home/jeel/Documents/SCM/backend/.env
set +a

echo "Running migration 005_webhook_schema_fixes.sql..."

# Run migration
PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -f /home/jeel/Documents/SCM/backend/migrations/005_webhook_schema_fixes.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
else
  echo "❌ Migration failed!"
  exit 1
fi
