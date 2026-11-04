#!/usr/bin/env bash
# Rebuilds a throw-away local database (fake data only) and runs every migration twice
# (idempotency) plus all test files. Usage:
#   PSQL="psql -h /path/to/socket -p 54329 -U postgres" supabase/tests/run_local.sh [dbname]
# Never point this at a real Supabase project.
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL="${PSQL:-psql}"
DB="${1:-t_local}"

$PSQL -d postgres -qc "drop database if exists $DB" -c "create database $DB"
run() { $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }

run supabase/tests/00_supabase_stub.sql
run supabase/tests/10_baseline_existing_schema.sql
for pass in 1 2; do
  for f in supabase/migrations/202611*.sql; do PGOPTIONS="-c client_min_messages=warning" run "$f"; done
  echo "migrations pass $pass: ok"
done

for t in supabase/tests/[2-9]*_*.sql; do
  echo "== $t"
  $PSQL -qAt -F ' | ' -d "$DB" -f "$t" | grep -E '^(FAIL|[0-9]+ \|)' || true
done
