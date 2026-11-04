# Local tests for the student-record migrations (no Supabase branch needed)

A plain local Postgres 16 stands in for Supabase. **Fake data only; never run against a real project.**

```bash
# one command: rebuilds a throw-away database, runs every 202611* migration twice (idempotency),
# then every numbered test file (20_, 21_, ...). Prints FAIL lines and "<passed> | <failed>" per file.
PSQL="psql -h /path/to/socket -p 54329 -U postgres" supabase/tests/run_local.sh t_local
```

Files:

- `00_supabase_stub.sql` — roles, `auth.uid()` / `auth.jwt()`, storage stub.
- `10_baseline_existing_schema.sql` — structure-only copy of the live schema (includes `selecao.registrar_checkin` verbatim).
- `05_harness.sql` — shared helpers (`t.ok`, `t.runs`, `t.throws`, `t.throws_code`, `t.affected`, `t.as_user`) included by the newer test files.
- `11_baseline_checkin_tables.sql` — structure-only copy of `turmas`, `allowed_users`, `attendance_records`.
- `20_rls_tests.sql` — student record: acts as each role (student, tutor, house leader, financeiro, secretaria,
  coordenacao, admin, legacy Propostas profile, anon) and proves `selecao.registrar_checkin` still creates/updates the
  student under the new triggers. One transaction, rolled back.
- `21_audit_roles_tests.sql` — migration 10: role/staff changes are audited.
- `22_avaliacao_tests.sql` — migration 11: question bank, evaluations, windows, comments, visibility per role.
- `23_notas_presenca_tests.sql` — migration 12: activities, final project, class days, justifications, attendance.
- `24_notas_calculadas_tests.sql` — migration 13: workbook parity (Tutoria 8.8 / Final 8.1), edge cases, end-to-end grades, release gating.
- `25_cobertura_tests.sql` — migration 14: coverage function (expected vs actual evaluators, no leaks, who can call it).

Each test file runs in one transaction and rolls back.
