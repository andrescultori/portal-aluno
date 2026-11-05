-- Phase 1B / step 20: the final-project grade is the plain average of three components (owner's formula):
--     Projeto = (Escrita + Projeto + Avaliação de pares) / 3      -> three components, equal weights (1 each).
-- Migration 12 seeded Projeto / Apresentação / Trabalho escrito with provisional equal weights. This renames the
-- two that change, for EVERY semester, keeping any grade already entered (the foreign key now updates with the code):
--     trabalho_escrito  -> escrita            "Escrita"
--     apresentacao      -> avaliacao_pares    "Avaliação de pares"
-- and new semesters are seeded with the three definitive components. Weights are not touched (they stay as they are,
-- 1 each today; the coordination can still change them in the app).

-- 1. let the grades follow a renamed component code
do $$
declare
  v_fk text;
begin
  select conname into v_fk
    from pg_constraint
   where conrelid = 'alunos.projeto_notas'::regclass
     and contype = 'f'
     and confrelid = 'alunos.projeto_componentes'::regclass;
  if v_fk is not null then
    execute format('alter table alunos.projeto_notas drop constraint %I', v_fk);
  end if;
  alter table alunos.projeto_notas
    add constraint projeto_notas_semestre_id_codigo_fkey
    foreign key (semestre_id, codigo) references alunos.projeto_componentes (semestre_id, codigo)
    on delete cascade on update cascade;
end $$;

-- 2. rename (idempotent: a second run finds nothing to rename; a semester that already has the new code is skipped)
update alunos.projeto_componentes c
   set codigo = 'escrita', nome = 'Escrita'
 where c.codigo = 'trabalho_escrito'
   and not exists (select 1 from alunos.projeto_componentes x where x.semestre_id = c.semestre_id and x.codigo = 'escrita');
update alunos.projeto_componentes c
   set codigo = 'avaliacao_pares', nome = 'Avaliação de pares'
 where c.codigo = 'apresentacao'
   and not exists (select 1 from alunos.projeto_componentes x where x.semestre_id = c.semestre_id and x.codigo = 'avaliacao_pares');
update alunos.projeto_componentes set nome = 'Projeto' where codigo = 'projeto' and nome <> 'Projeto';

-- 3. new semesters get the three definitive components
create or replace function alunos.tg_semestre_componentes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into alunos.projeto_componentes (semestre_id, codigo, nome, peso) values
    (new.id, 'projeto', 'Projeto', 1),
    (new.id, 'escrita', 'Escrita', 1),
    (new.id, 'avaliacao_pares', 'Avaliação de pares', 1)
  on conflict (semestre_id, codigo) do nothing;
  return new;
end $$;
revoke all on function alunos.tg_semestre_componentes() from public, anon, authenticated;
