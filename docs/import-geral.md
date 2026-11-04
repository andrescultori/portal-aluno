# Importação da LISTA GERAL (ensaio / dry-run)

> **Dados de alunos nunca entram no repositório.** A planilha e os relatórios ficam **fora** dele; o script se recusa a
> ler ou gravar dentro do repositório. Este documento descreve só a estrutura, as regras e os números agregados.

## Estado
Existe **apenas o ensaio** (`scripts/import-geral/`). Ele lê a planilha, valida, planeja o que seria gravado e confere com o
banco usando só hashes. **Não grava nada e não tem `--apply`** (rodar a importação de verdade depende de aprovação).

```bash
npm run test:import                      # testes unitários (dados fictícios)
npx tsx scripts/import-geral/cli.ts \
  --file "<caminho>/LISTA_GERAL_ALUNOS.xlsx" \
  --out  "<pasta FORA do repositório>" \
  --db-keys "<chaves.json>"              # opcional: conferência com selecao.candidatos (veja abaixo)
```
Saída: `relatorio-importacao.md` e `problemas.json` na pasta `--out` (linhas identificadas por **linha da planilha e RA**,
nunca por nome). No terminal só aparecem contagens.

## De onde vêm os dados (abas da planilha)
| Aba (tabela) | Linhas | Vira |
|---|---|---|
| `GERAL` (tabela `ALUNOS`, 54 colunas) | 1 por aluno | `alunos.alunos`, `alunos.dados_pessoais`, `alunos.aluno_igreja` |
| `SEMESTRES` (`TSEMESTRES`, cabeçalho na linha 8) | 1 por aluno e semestre | `alunos.matriculas` (ciclo, cenário→módulo, plano, alimentação/moradia/academia) |
| `CICLOS` (oculta) | 1 por aluno | `alunos.ciclo_status` (Básico/Avançado/Carreira: Completo/Incompleto/Cursando) |
| `SAÚDE` (`ALUNOSSAUDE`) | 1 por aluno | `alunos.aluno_saude` — casada **pelo nome completo** (a aba não tem RA) |
| `ADM` | — | semestre atual |
Não usadas: `STATUS`, `MATRICULADOS`, `LISTA EXTERNA*`, `ALUNOSDESATIVADOS`, `DASHBOARD`… (visões derivadas) e
`COLABORADORES` (pessoas das instituições, não alunos).

## Regras de mapeamento
- **Status:** Matriculado(a)→Ativo · Mat. Trancada→Trancado · Formado(a)→Formado · Desistência→Desistente · Desativado(a)→Desativado.
- **Turma** = semestre de ingresso (`AAAA-S`). `NOME` (fórmula) = `nome_exibicao`. `COLABORADOR` S/N = `colaborador`.
- **CPF:** só dígitos; o Excel perde zeros à esquerda, que são restaurados. **CEP:** 8 dígitos. **Telefones:** `+55DDNNNNNNNNN`
  (como o check-in já grava); números com `+` mantêm os dígitos.
- **Emergência** → `{nome, telefone, relacao}` (mesmas chaves do check-in); **pastor** → `{nome, telefone}`;
  **responsável acadêmico** → `{relacao, nome, telefone}`; `CONT. PREF.` → `contato_preferido`; `FOTO` → `foto_origem` (URL).
- Células só com traços ou erros de fórmula (`#N/A`) contam como vazias. `origem` = `planilha`.
- **RA vazio** é permitido (o índice único do banco é parcial) e fica sinalizado.
- **Nome com pequena diferença entre abas** (similaridade ≥ 0,90, melhor candidato único e claro): casado e **sinalizado**
  (`nome_aproximado`) para conferência humana.
- **Mesmo aluno em dois ciclos no mesmo semestre:** `matriculas` aceita uma linha por aluno e semestre; fica o **ciclo mais
  avançado** e a outra linha é descartada e sinalizada (`matricula_duplicada_descartada`). O status do ciclo continua em `ciclo_status`.
- Cenário → módulo: Básico (Universidade, Mercado de Trabalho, Missões Urbanas, Missões Transculturais), Avançado (Gestão de
  Projetos, Gestão de Carreira); Carreira/Convênio ficam sem módulo (o texto do cenário é guardado).
- **Primeiro semestre:** o primeiro semestre de todo aluno é o semestre da `TURMA`. Se a aba `SEMESTRES` não tiver linha para ele, a
  matrícula é **derivada** de `GERAL` (ciclo Básico — Convênio para quem tem plano Convênio; cenário/módulo ficam vazios porque não
  estão em `GERAL`; plano = plano atual) e sinalizada (`matricula_derivada_da_turma`).
- Semestres 2020-1 … 2026-2 são garantidos em `alunos.semestres` (sem datas, exceto os que a coordenação já cadastrou).

## Conferência com o banco (sem trocar dados pessoais)
O banco devolve só **os 12 primeiros dígitos do SHA-256** de e-mail (minúsculas), RA e CPF (só dígitos) de
`selecao.candidatos`, `alunos.alunos` e `allowed_users`, mais checksums md5 que provam que o arquivo não foi alterado ao copiar.
O ensaio informa: alunos sem candidato, ligados a um candidato, **conflitos** (chaves apontando para candidatos diferentes),
candidatos ligados a mais de um aluno, alunos que já existem e logins de portal que casam com a planilha.

### Atenção — `registrar_checkin` e alunos já importados (risco R1)
Se a importação ligar o aluno ao candidato (`candidato_id`), o check-in do Make não quebra (cai no `ON CONFLICT`), **mas
sobrescreve** nome, e-mail, telefone, curso, plano… e também `dados_pessoais` (inclusive emergência e pastor) com os valores
do candidato. Se o aluno **não** for ligado, o check-in falha por e-mail duplicado. Solução definitiva (Fase 2, precisa de
aprovação): fazer `registrar_checkin` preservar valores já existentes (`coalesce`). Enquanto isso, nenhum candidato fez check-in
(0 de 108).

## Resultado do ensaio na planilha real (agregado)
98 alunos · 444 matrículas (436 da planilha + 8 derivadas da `TURMA`) · 146 status de ciclo · 87 fichas de saúde · 14 semestres · **0 erros bloqueantes**.
66 alunos casam com exatamente um candidato (nenhum conflito), 32 não são candidatos, 0 já existem em `alunos.alunos`,
os 19 logins de aluno do portal casam com alunos da planilha (a presença passa a funcionar depois da importação).
Avisos para conferência humana: 3 linhas com nome aproximado (mesmo aluno), 2 matrículas duplicadas (dois ciclos no mesmo
semestre), 1 RA ausente, 1 CPF com dígito verificador inválido, 1 candidato com RA divergente, 8 alunos sem nenhuma linha em `SEMESTRES` (matrícula do semestre de ingresso derivada da `TURMA`).
