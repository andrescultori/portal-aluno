# Local tests for the student-record migrations (no Supabase branch needed)

A plain local Postgres 16 stands in for Supabase. **Fake data only; never run against a real project.**

```bash
createdb t1
psql -v ON_ERROR_STOP=1 -q -d t1 -f supabase/tests/00_supabase_stub.sql          # roles, auth.uid()/jwt(), storage stub
psql -v ON_ERROR_STOP=1 -q -d t1 -f supabase/tests/10_baseline_existing_schema.sql # structure-only copy of the live schema
for f in supabase/migrations/202611031*.sql; do psql -v ON_ERROR_STOP=1 -q -d t1 -f "$f"; done
# run the migrations a second time to prove they are idempotent
psql -qAt -F ' | ' -d t1 -f supabase/tests/20_rls_tests.sql | grep -E '^(FAIL|[0-9]+ \|)'
```

`20_rls_tests.sql` acts as each role (student, tutor, house leader, financeiro, secretaria, coordenacao,
admin, legacy Propostas profile, anon) and also proves that `selecao.registrar_checkin` — copied verbatim
into the baseline — still creates/updates the student under the new triggers. It runs in one transaction
and rolls back.
