# Fase 0 — Inspeção do banco e plano da Fase 1A (ficha do aluno)

> Documento de **estrutura**, sem dados de pessoas. Gerado por consultas somente-leitura
> ao projeto Supabase `elurrbjflkdpjddwqomc` em 2026-11-03. **Nada foi alterado no banco.**
> O modelo final (`docs/data-model.md`) será escrito depois da aprovação deste plano.

## 1. O que já existe

### Schemas e exposição na Data API
- Schemas de aplicação: `public`, `selecao`, `alunos`, `propostas`.
- **Data API expõe apenas** `public, graphql_public, propostas, selecao`.
  **`alunos` NÃO está exposto** → o front (supabase-js) hoje não consegue ler `alunos.*`.
- Extensões: `plpgsql`, `pgcrypto`, `uuid-ossp`, `supabase_vault`, `pg_stat_statements`.
- Storage: nenhum bucket existe.

### `alunos` (existente — estender, não recriar)
| Tabela | Colunas (resumo) | Restrições / índices |
|---|---|---|
| `alunos.alunos` (1 linha) | id, candidato_id (FK `selecao.candidatos`, `ON DELETE SET NULL`, único), user_id, ra, nome, email, telefone, sexo, data_nascimento, curso, nivel, modalidade, turno, plano, semestre_ingresso, status (default `Ativo`), checkin_em, origem (default `checkin`), criado_em, atualizado_em | CHECKs: semestre_ingresso `^\d{4}-[12]$`, sexo F/M, status Ativo/Trancado/Formado/Desistente. **Únicos: `lower(email)`, `ra` (parcial, não nulo), `candidato_id`.** Trigger `touch_atualizado_em` |
| `alunos.dados_pessoais` | aluno_id (PK, FK cascade), cpf, rg, orgao_rg, nacionalidade, estado_civil, profissao, endereco, cep, cidade, estado, pais, nome_mae, tel_mae, nome_pai, tel_pai, emergencia/fiador/pastor (jsonb), atualizado_em | CHECK cpf `^\d{11}$`; **único parcial em `cpf`** |

- RLS ligado nas duas. **Só existe política de SELECT** (nenhuma de INSERT/UPDATE/DELETE):
  - `alunos_leitura`: `selecao.eh_equipe() OR user_id = auth.uid()`
  - `alunos_dp_leitura`: `selecao.eh_coordenacao_ou_admin()` OU o próprio aluno (via `user_id`)
- Grants: `authenticated` só SELECT; `service_role` tudo. Escrita hoje = apenas `selecao.registrar_checkin` (security definer) e service role.
- **`alunos.alunos.user_id` nunca é preenchido** (0 de 1 linhas): nada liga o login (`auth.users`) à ficha.

### `selecao.registrar_checkin(p_segredo, p_kommo_lead_id)` — NÃO mexer
Security definer, `search_path=''`. Valida segredo, marca candidato como `Matriculado`, grava etapa `checkin`,
faz `INSERT … ON CONFLICT (candidato_id) DO UPDATE` em `alunos.alunos` (lista **explícita** de colunas) e em
`alunos.dados_pessoais`. É a única função que toca `alunos.*`. Colunas novas anônimas/nuláveis e a extensão do
CHECK de status **não a quebram**. Ver risco R1 abaixo (índices únicos).

### Papéis e helpers hoje (3 sistemas separados + 1 tabela de acesso)
| Helper | O que faz hoje |
|---|---|
| `public.current_papel()` | `allowed_users.papel` (`aluno`\|`equipe`) do e-mail do JWT, só ativos |
| `public.current_aluno_id()` | **`allowed_users.id`** do e-mail do JWT (não é o id de `alunos.alunos`!) |
| `propostas.papel_atual()` | `propostas.perfis.papel` (`emissor`\|`coordenacao`\|`admin`) por `user_id` |
| `propostas.e_admin()` / `e_coordenacao()` | papel = admin / papel ∈ (coordenacao, admin) |
| `selecao.eh_equipe()` | tem **qualquer** perfil em `propostas.perfis` (inclui `emissor`) |
| `selecao.eh_coordenacao_ou_admin()` / `eh_dados_pessoais()` | coordenação ou admin |
| `selecao.eh_mentor()` | está em `selecao.mentores` (ativo) |
| `selecao.eh_restrito()` | coordenação/admin **ou** mentor |
| `public.financeiro_pode_ver()` | e-mail em `public.financeiro_acesso` |
| `selecao.audita()` | trigger: grava em `selecao.auditoria` **só os nomes** dos campos alterados (sem valores antigos/novos), legível só por admin |

Contagens: `allowed_users` 4 equipe + 19 alunos (ativos); `propostas.perfis` 5 (1 admin, 1 coordenação, 3 emissor);
`selecao.mentores` 3; `financeiro_acesso` 3; `propostas.aprovadores` 3; `selecao.candidatos` 108; `alunos.alunos` 1.

### Presença e Edge Function
`checkin-presenca` usa service role e `allowed_users`. `attendance_records.aluno_id` → **`allowed_users(id)`**
(não `alunos.alunos`). Nada disso muda na Fase 1A.

### Outros achados
- Existem também `public.financeiro_acesso/_config/_dashboard` (não citados no briefing).
- `propostas.planos` (5): Completo, Alimentação, Moradia, Curso, Convênio. `selecao.candidatos.plano` só aceita Completo/Curso/Alimentação.
- Vercel: `vite.config.ts` sem `base` (= `/`) ✔; domínio `portal.unimissional.org.br` verificado ✔; `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` existem **só em Production** (Preview não tem → previews não logam); `VITE_GOOGLE_CALENDAR_*` em Production+Preview.
  A integração Vercel↔Supabase também injetou em Production `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET` e `POSTGRES_*`, que o app Vite **não usa** (sugestão: remover por mínimo privilégio).
- **Não verificável daqui:** Site URL e Redirect URLs de Auth no Supabase (não há ferramenta). Conferir: Site URL `https://portal.unimissional.org.br` e Redirect URL `https://portal.unimissional.org.br/**`.
- Histórico do git (62 commits): sem planilhas, CSV, `.env` ou CPF/telefone. `.gitignore` já atualizado neste commit (`data/`, `import-output/`, `*.xlsx`, `*.xls`, `*.csv`, `.env.*`).

## 2. Riscos encontrados

- **R1 — Check-in vs. importação (alto).** `registrar_checkin` só trata conflito em `candidato_id`. Os índices únicos
  `lower(email)`, `ra` e `cpf` já existem. Se a planilha importar um aluno (sem `candidato_id`) e depois esse mesmo
  e-mail/RA/CPF passar pelo check-in do Make, o `INSERT` **falha com violação de unicidade** e o check-in quebra.
  Mitigação proposta: antes do `--apply`, cruzar `selecao.candidatos` × planilha (e-mail/RA/CPF) e listar colisões;
  na Fase 2 ajustar `registrar_checkin` para casar por RA/e-mail e preencher `candidato_id` na ficha existente.
  **Não altero `registrar_checkin` agora, como pedido.**
- **R2 — `alunos` não exposto na Data API.** Sem isso a UI não funciona (ver decisão D3).
- **R3 — Duas identidades de aluno.** Login/presença usam `allowed_users` (19); ficha acadêmica usa `alunos.alunos` (1).
  Ponte proposta: e-mail (`lower(alunos.email) = lower(allowed_users.email)`), preenchendo `alunos.alunos.user_id` por
  trigger no login (como `handle_new_auth_user`) + backfill. O nome `current_aluno_id()` já existe em `public` com
  **outro significado**; o novo helper terá nome distinto: `alunos.my_aluno_id()`.
- **R4 — Escrita inexistente hoje em `alunos.*`.** Todas as políticas de escrita serão novas.
- **R5 — Auditoria existente não guarda valores.** A nova pede JSON antigo/novo; ver D7.

## 3. Decisões que preciso de você (D1–D8)

- **D1 Mapeamento de pessoas → papéis** (tabela enviada no chat). Nada será concedido sem sua confirmação.
- **D2 `emissor`:** manter como papel legado em `staff_roles` (os helpers antigos continuam idênticos) — recomendado.
- **D3 Expor `alunos` na Data API** (`pgrst.db_schemas` += `alunos`, via migration + `NOTIFY pgrst`) — recomendado — ou criar views/RPCs em `public`.
- **D4 Ponte login↔ficha por e-mail** (R3) — recomendado.
- **D5 Check-in × importação** (R1): confirmar a estratégia (cruzar antes do `--apply`; ajustar `registrar_checkin` na Fase 2).
- **D6 Planos:** a planilha tem "Equipe", ausente em `propostas.planos`. Opções: (a) inserir `Equipe` com `ativo=false` em `propostas.planos` (reuso, mexe em dado de referência do App de Propostas); (b) guardar `matriculas.plano` como texto validado por CHECK próprio. Recomendo (a). Pacotes (Missão/Propósito/Vocação/Reino): tabela nova `alunos.pacotes`, valores vindos da planilha.
- **D7 Auditoria:** `alunos.auditoria` com JSON antigo/novo (inclui dados de saúde/documentos → cópia sensível). Proposta: só admin lê, ninguém escreve pelo cliente, CPF mascarado no JSON. Alternativa: só nomes dos campos (como `selecao.auditoria`).
- **D8 Teste de RLS:** exige **Supabase branch** (gera custo; preciso da sua confirmação de custo). Alternativa: bloco `BEGIN … ROLLBACK` em produção (não recomendo para DDL).

## 4. Plano de migrations (ordem; todas idempotentes; nenhuma aplicada)

1. `roles_staff_roles` — `public.staff_roles(email, user_id, role)` (+ CHECK: admin, coordenacao, secretaria, financeiro, tutor, mentor, lider_casa, emissor-legado); helpers `current_roles()`, `has_role()`, `is_staff()`, `can_view_aluno()`; seed a partir de `allowed_users`, `propostas.perfis`, `selecao.mentores`, `financeiro_acesso` (após D1); helpers antigos viram wrappers de mesma tabela-verdade; `allowed_users` continua como está (view/sync não é necessária: ele segue sendo a fonte do login).
2. `alunos_reference_tables` — `semestres`, `ciclos`, `modulos` (seed: 4+2), `casas` (seed 5), `pacotes`; (planos conforme D6).
3. `alunos_extend_core` — colunas nuláveis em `alunos.alunos`; CHECK de status + `Desativado`; mapeamento de rótulos da planilha na UI; `responsavel_academico`/`contato_preferido` em `dados_pessoais`; índices pedidos.
4. `alunos_student_tables` — `aluno_igreja`, `aluno_saude`, `aluno_status_historico` (+ trigger em `status`), `equipe`, `equipe_casas`, `aluno_tutores`.
5. `alunos_enrollment` — `matriculas`, `ciclo_status`.
6. `alunos_audit` — `alunos.auditoria` + triggers em alunos, dados_pessoais, aluno_saude, aluno_igreja, matriculas, ciclo_status.
7. `alunos_rls` — políticas da matriz + triggers `enforce_student_self_update` (aluno só altera celular, whatsapp, foto, endereço, emergência, saúde e igreja; nunca `status`, `ra`, `casa_id`) + grants (`revoke … from anon`).
8. `alunos_storage` — bucket privado `alunos-fotos` (e depois `alunos-documentos`) + RLS em `storage.objects` pelas mesmas regras.
9. `alunos_expose_schema` — `pgrst.db_schemas` (D3).

## 5. Testes de RLS (em branch)
Agir como cada papel e verificar: tutor não lê `aluno_saude`; aluno não lê outro aluno; aluno não altera `status`/`ra`/`casa_id`;
secretaria não lê saúde; **`selecao.registrar_checkin` continua criando o aluno** (com dados de teste, sem pessoas reais).
Resultado será mostrado antes de qualquer merge.
