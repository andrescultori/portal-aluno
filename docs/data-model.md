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

### 5.3 Migration 12 — activities, final project, attendance

**Activities.** `atividades` (weekly class topics per semester; titles typed by coordenação/admin) and
`atividade_notas` (`ativ` 0..9, `quiz` 0..1, both nullable; `final` is a generated column = `ativ + quiz`, **null when both
are empty — null is never 0**; a missing component counts as 0 once the other is entered). `Atividades` =
`avg(final)` over the activities the student has a grade for (`alunos._atividades_calc`; also reports total/graded counts).

**Final project.** `projeto_componentes(semestre_id, codigo, nome, peso)` — seeded for every new semester by a trigger with
the three definitive components (`projeto` "Projeto", `escrita` "Escrita", `avaliacao_pares` "Avaliação de pares") and equal
weights, i.e. the owner's formula **Projeto = (Escrita + Projeto + Avaliação de pares) / 3** (migration 20 renamed the
provisional `apresentacao` / `trabalho_escrito`); coordenação/admin can still edit the weights (UI, no code change).
`projeto_notas` (0..10). `Projeto` = weighted mean of the components that have a grade, weights renormalised over those; the
missing component codes are returned (`alunos._projeto_calc`) and the result is flagged partial until all three exist;
zero-weight components are ignored; no grades → null.

**Who edits.** Grades (`atividade_notas`, `projeto_notas`): **admin and the student's tutor** (tutoria assignment of that
semester); coordenação reads but cannot edit; secretaria/financeiro/student read nothing. Every change is audited
(`atualizado_por/em` are stamped; `registro_id` = student). `justificativas`: admin, coordenação, secretaria and the
student's tutor. `dias_letivos`: staff read; admin/coordenação/secretaria edit.

**Attendance (check-in tables and the Edge Function are untouched).** `public.attendance_records.aluno_id` points to
`allowed_users(id)`, not `alunos.alunos`. `alunos.v_presenca_aluno` joins the two by e-mail (case-insensitive); it is not
granted to API roles (security-definer functions read it). **How status is decided (read from
`supabase/functions/checkin-presenca/index.ts`):** at check-in the function computes the status on the server from the
student's class (`turmas.horario_inicio`, `horario_fim_presente`, `horario_fim_atraso`, all configurable per class): window
opens 5 minutes before `horario_inicio`; `presente` if now ≤ `horario_fim_presente`, otherwise `atraso` until
`horario_fim_atraso`; outside the window nothing is written. The stored status is frozen at check-in. The function never
writes `falta`: **absent = no row** (a manual `falta` row also counts as absent).

`Presença` (0..10) = `(present × 1 + late × 0.5) / (class days − justified absences) × 10`, unrounded
(`alunos._presenca_calc`): class days = `dias_letivos` with `aula = true` up to a cut-off date (default: yesterday,
America/Sao_Paulo, so today's class never counts as an absence; pass the semester end for a closed semester); a
justification only reduces the denominator if the student did not check in that day; empty/fully justified denominator → null;
a student who cannot be joined to a login → `vinculado = false` and null (never a fake 0). Class days are generated from
`semestres.inicio/fim` by `alunos.gerar_dias_letivos(semestre)` (Mon–Fri) and holidays are edited with `aula = false`.
`alunos.presenca_sem_vinculo()` lists active students with no login and student logins with no student record.

**Access to the numbers.** The `_…_calc` functions are internal (service role only); the staff screens use the
role-checked wrappers `presenca_aluno`, `atividades_aluno`, `projeto_aluno` (admin, coordenação, or the student's tutor).
Migration 13 combines them and applies the release gate for students.

### 5.4 Migration 13 — computed grades (all in SQL)

Per `(aluno, semestre)`; components stay **unrounded**, only `tutoria`, `mentoria` and `final` are rounded
(`round(numeric, 1)` = half away from zero = half up for positive values). Only **submitted** evaluations count.

| Value | Rule |
|---|---|
| `teoria`, `pratica` | mean over the 4 questions of the group of (mean over evaluators of points, valor 1 ignored) |
| `atividades`, `projeto`, `presenca` | migration 12 |
| `tutoria` | `round(avg of the non-null, non-zero values among [teoria, pratica, atividades, projeto, presenca], 1)` |
| `mentoria` | `round(mean of the question means of the Mentoria model, 1)` (valor 1 ignored at both levels) |
| `final` | `round(avg of the non-null, non-zero values among [tutoria, mentoria], 1)` — on the **already rounded** values |
| `conceito` | `alunos.conceitos` (lower bounds 0 / 5 / 7 / 9 = Insatisfatório / Regular / Bom / Excelente; editable) |
| `aprovado` | `final >= alunos.notas_config.aprovacao` (6.0, editable). No recovery. |

The pure formulas are separate functions so the workbook case can be tested directly: `alunos.calc_tutoria(...)`,
`alunos.calc_final(...)`, `alunos.conceito_de(...)`, `alunos.aprovado_de(...)`. **Workbook parity (semester 2024-1):**
Teoria 9, Prática 8.5, Atividades 9.12, Projeto 8.5, Presença 8.7 → Tutoria 8.8; Mentoria 7.3 → Final 8.1 (averaging the
unrounded values would give 8.0). Extra cases tested: a 0/null component excluded, no Mentoria, 5.9 / 6.0 boundary,
half-up on x.x5 values, and an end-to-end run through real evaluations, activities, project grades and check-ins.

**Partial results.** `completo` is false and `pendencias` (jsonb) lists what is missing: `tutoria_sem_avaliacoes`,
`tutoria_avaliadores_faltando {enviadas, esperados, faltando}`, the same for `mentoria_*`, `atividades_nao_cadastradas`,
`atividades_sem_notas`, `atividades_parcial {com_nota, total}`, `projeto_componentes_faltando {faltando[]}`,
`presenca_sem_vinculo`, `presenca_indisponivel`. A partial `final` is never definitive. Expected evaluators = explicit
`aluno_tutores` assignments (+ for Mentoria, the active house leaders with the `lider_casa` role).

**Cycle averages.** `media_basico` / `media_avancado` = mean of the semester finals of the semesters whose enrolment
(`matriculas.ciclo_id`) is in that cycle; `media_final` = mean of **all** semester finals; each rounded to 1 decimal; the
number of incomplete semesters is returned so screens can warn. *(Open point: if the workbook defines Média final as the
mean of the two cycle averages, change `_medias_ciclo_calc`; the two agree when both cycles have the same number of semesters.)*

**Access.** `_perguntas_calc`, `_nota_semestre`, `_historico_calc`, `_medias_ciclo_calc` are internal (service role).
Staff wrappers — admin and coordenação only: `notas_aluno`, `notas_semestre`, `perguntas_aluno`, `historico_aluno`,
`medias_ciclo_aluno`. Tutors/mentors, secretaria, financeiro and students cannot call them. Student functions —
`meu_desenvolvimento()`, `meu_desenvolvimento_perguntas(semestre)`, `minhas_medias_ciclo()` — take no student id, return
only the logged-in student's rows, and only for semesters where `alunos.semestre_liberado` is true (every window of the
semester released). They expose question means with the evaluator **count**, never an evaluator, a comment or the
pending list. Before release they return nothing ("Resultados ainda não liberados" in the UI).

### 5.5 Migration 14 — coverage for the coordination screen

`alunos.cobertura_semestre(semestre)` (read-only, admin/coordenação): one row per (student, category, evaluator) with
`esperado` (true = assigned, or house leader in Mentoria — the same rule as the grade calculation), `situacao`
(`nao_iniciada` | `rascunho` | `enviada` | `sem_avaliador`) and answered/total counts. Evaluations by someone who was not
assigned appear with `esperado = false`; a student/category with nobody gets one `sem_avaliador` row. Students: `Ativo`,
plus anyone already evaluated in the semester. Never returns answers or comments.

### 5.6 Migration 15 — who is evaluated ("avaliável")

`alunos.avaliavel(aluno, semestre)` is the **single place** for the rule. A student is evaluable in a semester when
`status = 'Ativo'` **and** the plan of that semester's enrolment (falling back to the student's current plan) is not an
agreement plan (`alunos.planos.convenio`, today "Convênio") — **or** the student already has an evaluation in that
semester (drafts and submitted ones stay valid, so someone who graduates or locks after being evaluated keeps results).
The owner's wording was "status other than Ativo and plan Convênio won't be evaluated"; it was implemented as
*either* condition excludes (changing it means editing this one function).
Applied in: `_avaliadores_esperados` (grades' pendências, coverage), `cobertura_semestre`, `meus_alunos_avaliar`,
`pode_avaliar`. `alunos.avaliaveis_semestre(semestre)` (admin/coordenação) returns status, effective plan, `convenio`
and the verdict per student for the screen filters.

### 5.7 Migration 16 — staff management

A staff member lives in `allowed_users` (login), `staff_roles` (functions) and `alunos.equipe` (evaluator list, feeds the
Atribuições dropdowns). `public.listar_equipe()` (admin/coordenação) lists the union; `public.salvar_membro_equipe(email,
nome, papeis, ativo)` creates/updates all three in one call. Admin: any function. Coordenação: only tutor / mentor /
lider_casa, and only for people who hold nothing above that. Nobody is deleted (deactivation keeps assignments and
evaluations). The legacy `emissor` role is never touched. Guards: cannot deactivate yourself or drop your own admin role;
a student login cannot be turned into staff by accident.

### 5.8 Migration 17 — correcting the attendance list

`public.attendance_records` has no write policy for people (check-in writes it through the Edge Function). Corrections go
through two guarded functions, never by touching the table, the policies or the Edge Function:
`public.corrigir_presenca(registro, status, motivo)` (admin, coordenação, secretaria) and
`public.apagar_presenca(registro, motivo)` (admin, coordenação). Both require a reason and write `alunos.auditoria`
(who, when, before/after, `motivo` — a new nullable column). A deleted record is kept in full in the audit row (`antes`),
so it can be restored by hand; if the student checks in again the same day the normal check-in works.

### 5.9 Migration 18 — the development text is required

`alunos.enviar_avaliacao` now also refuses to submit when the `desenvolvimento` comment ("Como você acredita que foi o
desenvolvimento do(a) aluno(a)?") is empty or blank — the same as the original Microsoft Forms (owner's decision, 2026-11-05).
Drafts can still be saved without it. The coordination override (submitting on someone's behalf) needs it too.
The form shows the field as required, with a hint, and keeps "Revisar e enviar" disabled until it is written.

### 5.10 Migration 19 — a student's absent days

`alunos.faltas_aluno(aluno, semestre, até)` (read-only; admin, coordenação, the student's tutor, secretaria) lists the class
days (`dias_letivos.aula = true`, up to the cut-off — default yesterday) on which the student has no `presente`/`atraso`
check-in, each with `justificada` and `motivo`. Same rule as `_presenca_calc`, so the list always agrees with the Presença
grade; a student without a login linked to the check-in gets no rows. It exists so a tutor can justify absences without
remembering the dates.

### 5.11 Migration 20 — definitive project components

Owner's formula: the final-project grade is the plain average of three components. Existing components were renamed for
every semester (`trabalho_escrito` → `escrita` "Escrita", `apresentacao` → `avaliacao_pares` "Avaliação de pares"); the
grades follow the new code (the foreign key got `on update cascade`); weights untouched; new semesters are seeded with the
three. Idempotent (tested on a database that already had grades under the old codes).

### 5.12 Step 21 — `excluir_checkin` (documented and fixed)

`public.excluir_checkin(p_id, p_motivo)` was created directly in the SQL Editor (not in the repo) and is what the attendance
screen's "Excluir check-in" calls: any staff login (`allowed_users.papel = 'equipe'`) or admin/coordenação/secretaria, reason
required, the row is deleted and a full copy goes to `alunos.auditoria` (`antes` = the row, `depois` = `{motivo}`). The repo
now has it (migration 21) with **one security fix**: for a signed-in user with no row in `allowed_users`, `current_papel()` is
NULL, `NOT (false OR NULL)` is NULL, and the guard did not raise — the function deleted. The check is now
`coalesce(current_papel(), '') = 'equipe'`. `public.apagar_presenca` (migration 17) is the stricter twin (admin/coordenação only,
fills `auditoria.motivo`); the screen uses `excluir_checkin`. Lesson for every future guard: never `if not (… or f() = 'x')`
with a function that can return NULL — wrap it in `coalesce`.

### 5.13 Screens (so far)

| Route | Who | What |
|---|---|---|
| `/admin/avaliacoes` — Semestre | admin, coordenação | create/choose the semester, dates, current semester, generate class days |
| `/admin/avaliacoes` — Atribuições | admin, coordenação | tutors/mentors per student, filters, bulk assignment by list or house |
| `/admin/avaliacoes` — Períodos e liberação | admin, coordenação | evaluation window per category (Brasília time), release/unrelease/schedule the results (sets `liberada_em` on every window of the semester), pending-per-student summary before releasing |
| `/admin/avaliacoes` — Quem já avaliou | admin, coordenação | coverage by evaluator or by student, filters, "copy pending list" |
| `/admin/avaliacoes` — filter "Situação" | admin, coordenação | global (URL `?status=`) in Atribuições and Quem já avaliou; default = who will be evaluated |
| `/admin/avaliar`, `/admin/avaliar/:categoria/:alunoId` | tutor, mentor, lider_casa | own students, evaluation form with autosave, review and submit (old `/avaliar…` URLs redirect) |
| `/admin/usuarios` — Equipe e acessos | admin, coordenação | staff only: functions, active/inactive; reflected in the Atribuições dropdowns |
| `/admin/turmas` — Turmas e alunos | all staff (RLS filters) | tabs: Alunos (list + filters), Acessos de alunos (portal logins), Turmas e QR Code |
| `/admin/relatorio` — Presença | all staff read; admin/coordenação/secretaria edit status; any staff login deletes a check-in | each line has Editar (`corrigir_presenca`, migration 17) / Excluir check-in (`excluir_checkin`, migration 21), both with a mandatory reason, audited; success/error toasts; filters can come from the URL (`?turma=&de=&ate=`); deleting a class that has check-ins explains it and links to them |
| `/admin/avaliacoes` — Semestre › Dias sem aula | admin, coordenação, secretaria | list / undo / add days without class (`dias_letivos.aula = false`, with reason); "Buscar no Google Agenda" suggests national holidays (Google's Brazilian holiday calendar, pre-checked), the school calendar (`VITE_GOOGLE_CALENDAR_ID`, pre-checked when the title says feriado/recesso/sem aula) and bridge days (holiday on Tuesday → Monday, on Thursday → Friday; never pre-checked). Uses the public calendar API key; no migration |
| `/admin/notas` — Notas e presença | tabs per role: Atividades and Projeto final (admin, coordenação, tutor); Presença e faltas (+ secretaria) | **Atividades:** pick the class, type `Atividade` (0–9) and `Quiz` (0–1) per student with the keyboard (Enter/↑↓), the DB computes the class grade and the average; coordenação/admin create and rename activities (never deleted). **Projeto final:** components and weights (coordenação/admin; new components start at weight 0; a note explains that equal weights = plain average of the three), grades 0–10 (2 decimals) per component, the project grade computed in the DB. **Presença e faltas:** summary + the student's absent days with *Justificar* (reason) / *Desfazer*. Tutors see only their Tutoria students; coordenação reads but cannot edit grades (RLS); the DB re-checks every write |
| `/meu-desenvolvimento` (student portal) | the logged-in student | **only released semesters** (`alunos.meu_desenvolvimento*`, no student id is ever sent): average cards (final / Básico / Avançado), line chart of the final grade per semester (single series, fixed 0–10 scale, direct labels) with a table alternative, per-semester thin bars for each component + final, concept, approved/partial badge, and per-question means with the number of evaluators (never names or comments). Before release: "Resultados ainda não liberados". Menu link only for student logins |
| `/admin/resultados` | admin, coordenação | per-semester grades for every student from `alunos.notas_semestre` (same "Situação" filter, house, search, sort), partial results flagged, per-student detail (what is missing, evaluators sent, per-question means via `perguntas_aluno`), CSV/Excel export |
| `/admin/alunos/:id` | all staff (RLS filters) | student page: summary, status change with reason + history (admin/coordenação/secretaria), enrolments, personal data (where RLS allows), and for admin/coordenação a "Desenvolvimento" section (semester results + cycle averages from `historico_aluno` / `medias_ciclo_aluno`) |

Menus only *show* items per role; every read and write is authorized by RLS.
