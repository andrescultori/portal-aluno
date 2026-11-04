-- Phase 1B / step 10: audit role and staff changes.
-- Who holds which role decides who can read student data, so every change to
-- public.staff_roles, alunos.equipe and alunos.equipe_casas is recorded in alunos.auditoria
-- (same trigger function as the student tables; admin-only read).
--
-- alunos.audit_row() derived registro_id from `aluno_id` or `id`. alunos.equipe_casas has
-- neither (composite key equipe_id + casa_id), so its rows would be logged with a NULL
-- registro_id. The function is re-created with one extra fallback; behaviour for the tables
-- already audited is unchanged (aluno_id first, then id).
--
-- Changes made from the SQL Editor / service role have no end-user JWT, so usuario and
-- usuario_email are NULL in those rows (the row itself is still recorded).

create or replace function alunos.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_id text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := alunos.audit_mask(to_jsonb(old)); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := alunos.audit_mask(to_jsonb(new)); end if;

  -- ignore no-op updates (only the touch timestamp changed)
  if tg_op = 'UPDATE' and (v_old - 'atualizado_em') = (v_new - 'atualizado_em') then
    return null;
  end if;

  v_row := coalesce(v_new, v_old);
  v_id := coalesce(
    v_row ->> 'aluno_id',
    v_row ->> 'id',
    nullif(concat_ws(':', v_row ->> 'equipe_id', v_row ->> 'casa_id'), ''));

  insert into alunos.auditoria (usuario, usuario_email, tabela, operacao, registro_id, antes, depois)
  values (auth.uid(), nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''),
          tg_table_name, tg_op, v_id, v_old, v_new);
  return null;
end $$;

revoke all on function alunos.audit_row() from public, anon, authenticated;

drop trigger if exists trg_audit on alunos.equipe;
create trigger trg_audit after insert or update or delete on alunos.equipe
  for each row execute function alunos.audit_row();

drop trigger if exists trg_audit on alunos.equipe_casas;
create trigger trg_audit after insert or update or delete on alunos.equipe_casas
  for each row execute function alunos.audit_row();

drop trigger if exists trg_audit on public.staff_roles;
create trigger trg_audit after insert or update or delete on public.staff_roles
  for each row execute function alunos.audit_row();
