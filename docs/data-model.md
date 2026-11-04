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

Added migration by migration; each part is filled in when its migration is written.

### 5.1 Migration 10 — audit of roles and staff ✅
See §4.

### 5.2 Migration 11 — question bank, evaluations, windows, comments

**Question bank (versioned, reference data).** `avaliacao_modelos` (categoria `tutoria`|`mentoria`, `versao`, `ativo`,
plus the wording of the two free-text prompts) → `avaliacao_grupos` → `avaliacao_perguntas`. `avaliacao_escala` holds the
five labels (1 *Não posso/não sei responder*, 2 *Insatisfatório*, 3 *Regular*, 4 *Bom*, 5 *Excelente*); the points live
in one place, `alunos.pontos(valor)`: 1 → excluded (null), 2→4, 3→6, 4→8, 5→10. Seeded: Tutoria v1 (Teoria 4 + Prática 4),
Mentoria v1 (Encontro 2, Autocuidado físico 3, Práticas espirituais 2, Vida em comunidade 4). One active model per
category (partial unique index). **A model that already has evaluations is frozen** (trigger, SQLSTATE 55006):
coordenação/admin create a new version with `alunos.nova_versao_modelo(categoria)` (clones groups + questions, inactive),
edit it freely while it has no evaluations, then `alunos.ativar_modelo(id)`. Old evaluations keep their model.

**Evaluations.** `avaliacoes` (one per `semestre + aluno + avaliador + categoria`; `categoria` is checked against the
model by a composite FK, so a new model version never opens a second slot), `avaliacao_respostas` (valor 1..5, the
question must belong to the evaluation's model), `avaliacao_comentarios` (`observacoes`, `desenvolvimento` — separate
table so `select *` on the evaluation can never leak them). Status `rascunho` → `enviada` only through
`alunos.enviar_avaliacao(id)`: every question answered; any answer below 4 (*Bom*), **including 1**, requires a non-blank
`observacoes`. Evaluators additionally need an open window and the assignment; coordenação/admin (and calls without a
JWT) skip those two checks but not the content rules. Coordenação/admin may edit after submit and reopen
(`status = 'rascunho'`); evaluators cannot. Keys (semester, student, evaluator, model, category) never change.

**Who may evaluate** (`alunos.pode_avaliar`): staff (not emissor-only) whose own `equipe` row is the evaluator and
who is assigned in `aluno_tutores` for that semester and category — or, for Mentoria, has the `lider_casa` role and
`equipe_casas` contains the student's house. **Windows** (`avaliacao_janelas`, per semester + category): `abre_em`,
`fecha_em`, `liberada_em`; no dates are hard-coded; drafts and submission both require an open window (coordenação/admin
override). `alunos.semestre_liberado(semestre)` is true only when the semester has windows and **every** one has
`liberada_em <= now()`.

**Visibility (RLS).** Evaluator: own evaluations, answers and comments only. Coordenação/admin: everything.
Student, secretaria, financeiro, emissor-only, anon: no raw rows at all (students get only their own aggregates after
release, through the functions of migration 13). Locked rows are filtered by RLS (0 rows affected, no error); the
triggers raise explicit errors as a second line of defence. `alunos.meus_alunos_avaliar(semestre)` returns the
evaluator's own list (explicit assignments + house-leader derivation) with status and progress.

**Audit.** Every table of the module has `trg_audit`; `registro_id` is `aluno_id`, else `id`, else `avaliacao_id`,
else `equipe_id:casa_id`, else `semestre_id:categoria`.

- Migration 12 — activities, final project, attendance (planned).
- Migration 13 — computed grades (planned).
