-- Phase 1A / step 3: extend the EXISTING alunos.alunos / alunos.dados_pessoais.
-- Only nullable or defaulted columns are added; nothing is renamed or dropped, so
-- selecao.registrar_checkin (explicit column list, ON CONFLICT candidato_id) keeps working.

alter table alunos.alunos
  add column if not exists nome_exibicao text,
  add column if not exists casa_id int references alunos.casas (id) on delete set null,
  add column if not exists colaborador boolean not null default false,
  add column if not exists inicio date,
  add column if not exists conclusao date,
  add column if not exists obs text,
  add column if not exists celular text,
  add column if not exists whatsapp text,
  add column if not exists tel_residencial text,
  add column if not exists foto_path text,
  add column if not exists foto_origem text;  -- Google Drive URL from the spreadsheet (until files move to Storage)

-- `telefone` stays the main phone. Status: keep the 4 old values valid, add 'Desativado'.
alter table alunos.alunos drop constraint if exists alunos_status_check;
alter table alunos.alunos add constraint alunos_status_check
  check (status in ('Ativo', 'Trancado', 'Formado', 'Desistente', 'Desativado'));
-- UI labels (spreadsheet wording) are mapped in the app:
--   Matriculado(a)=Ativo, Mat. Trancada=Trancado, Formado(a)=Formado,
--   Desistência=Desistente, Desativado(a)=Desativado.

alter table alunos.dados_pessoais
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists responsavel_academico jsonb,
  add column if not exists contato_preferido text;

create index if not exists alunos_status_ix on alunos.alunos (status);
create index if not exists alunos_semestre_ingresso_ix on alunos.alunos (semestre_ingresso);
create index if not exists alunos_casa_ix on alunos.alunos (casa_id) where casa_id is not null;
