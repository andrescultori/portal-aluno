# Data model — Portal do Aluno

> Structure and rules only; **no data about people lives in the repository**. Student data lives in
> Supabase (Postgres + private Storage). See `docs/fase-0-inspecao-e-plano.md` for the inspection and decisions.
> Migrations are applied manually by the owner; local tests live in `supabase/tests/`.

## 1. Schemas

| Schema | Owner of | Notes |
|---|---|---|
| `public` | login whitelist (`allowed_users`), check-in (`turmas`, `attendance_records`), `staff_roles`, role helpers | `attendance_records.aluno_id` → `allowed_users.id` (NOT `alunos.alunos.id`) |
| `selecao` | admission process, `registrar_checkin` | **Do not touch.** |
| `propostas` | Propostas app | **Do not touch.** Stays separate. |
| `alunos` | the student record and everything academic | exposed in the Data API (`pgrst.db_schemas`) |

## 2. Roles (`public.staff_roles`, migration 1)

One row per `(email, role)`; matched by the verified e-mail in the JWT. Roles: `admin`, `coordenacao`,
`secretaria`, `financeiro`, `tutor`, `mentor`, `lider_casa`, and the legacy label `emissor` (grants nothing).
Helpers (security definer, `search_path = ''`): `current_roles()`, `has_role(r)`, `has_any_role(rs)`, `is_staff()`.
A student is identified by `alunos.my_aluno_id()` (`alunos.user_id = auth.uid()` or `lower(alunos.email)` = JWT e-mail).
`public.can_view_aluno(id)` = admin/coordenacao/secretaria/financeiro, the student themself, an assigned
tutor/mentor (current semester) or the house leader of the student's house.

## 3. Student record (`alunos`, migrations 2–8)

- Reference: `semestres` (one `atual`), `ciclos` (Básico, Avançado, Carreira, Convênio), `modulos`, `casas`, `planos`, `pacotes`.
- Core: `alunos` (existing; extended), `dados_pessoais` (existing; extended), `aluno_igreja`, `aluno_saude` (restricted),
  `aluno_status_historico` (written by trigger; humans use `alunos.change_status(id, status, reason)`).
- Enrollment: `matriculas` (unique aluno+semestre), `ciclo_status`.
- Team: `equipe` (people who can be assigned; linked to `staff_roles` by e-mail), `equipe_casas` (house leaders),
  `aluno_tutores` (student ↔ equipe per semester; `categoria` = `tutoria` | `mentoria`).
- Storage: private bucket `alunos-fotos`, path `<aluno_id>/<file>`.

### RLS matrix (admin can do everything)

| Table | Student (own) | tutor / mentor | lider_casa | coordenacao | secretaria | financeiro |
|---|---|---|---|---|---|---|
| `alunos` | read; edits only celular, whatsapp, foto_path | read assigned | read own house | read/write | read/write | read |
| `dados_pessoais` | read; edits address + emergency | – | – | read | read/write | read |
| `aluno_igreja` | read/write | – | – | read/write | read/write | – |
| `aluno_saude` | read/write | – | – | read | – | – |
| `matriculas`, `ciclo_status` | read | read assigned | read own house | write | write | read |
| `aluno_status_historico` | – | – | – | read | read | – |

Reference tables: readable by any logged-in user, editable by admin/coordenacao. `anon` has no grants anywhere.
Calls without an end-user JWT (service role, security-definer RPCs such as `selecao.registrar_checkin`) are not
restricted by the student column guards.

## 4. Audit (`alunos.auditoria`, migrations 6 and 10)

Row-level trigger `trg_audit` → `alunos.audit_row()` records who (`auth.uid()`, JWT e-mail), when, table, row id,
old/new JSON (CPF masked). Admin-only read; nobody writes from the client. Audited tables:
`alunos`, `dados_pessoais`, `aluno_saude`, `aluno_igreja`, `matriculas`, `ciclo_status`, `aluno_tutores`
(migration 6) and **`public.staff_roles`, `alunos.equipe`, `alunos.equipe_casas`** (migration 10: role changes decide
who can read student data). `registro_id` = `aluno_id`, else `id`, else `equipe_id:casa_id`. Changes made from the
SQL Editor / service role have no JWT, so the actor columns are NULL (the change itself is still recorded).

## 5. Phase 1B — evaluation module (in progress)

Added migration by migration; each section below is filled in when its migration is written.

- Migration 10 — audit of roles and staff ✅ (this document, §4).
- Migration 11 — question bank, evaluations, windows, comments (planned).
- Migration 12 — activities, final project, attendance (planned).
- Migration 13 — computed grades (planned).
