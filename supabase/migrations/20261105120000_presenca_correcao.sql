-- Phase 1B / step 17: correct or delete a check-in record (attendance list is editable).
--
-- public.attendance_records has no write policy for people (check-in writes it through the Edge Function with the
-- service role), so corrections go through two guarded functions. Nothing about the check-in table, its policies
-- or the Edge Function changes.
--   public.corrigir_presenca(registro, status, motivo)  admin, coordenacao, secretaria
--   public.apagar_presenca(registro, motivo)            admin, coordenacao
-- Both require a reason and write alunos.auditoria (who, when, before/after, reason). A deleted record is kept in
-- full inside the audit row ("antes"), so it can always be restored by hand. If the student checks in again the same
-- day the normal check-in works (the row is gone, so the unique key is free).

alter table alunos.auditoria add column if not exists motivo text;

create or replace function public.corrigir_presenca(p_registro uuid, p_status text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.attendance_records;
  v_new public.attendance_records;
begin
  if not public.has_any_role(array['admin', 'coordenacao', 'secretaria']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if p_status is null or p_status <> all (array['presente', 'atraso', 'falta']) then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  select * into v_old from public.attendance_records where id = p_registro for update;
  if not found then
    raise exception 'record not found' using errcode = 'P0002';
  end if;
  if v_old.status = p_status then
    raise exception 'No change' using errcode = '22023';
  end if;

  update public.attendance_records set status = p_status where id = p_registro returning * into v_new;

  insert into alunos.auditoria (usuario, usuario_email, tabela, operacao, registro_id, antes, depois, motivo)
  values (auth.uid(), nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''), 'attendance_records', 'UPDATE',
          p_registro::text, alunos.audit_mask(to_jsonb(v_old)), alunos.audit_mask(to_jsonb(v_new)), btrim(p_motivo));
end $$;

create or replace function public.apagar_presenca(p_registro uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.attendance_records;
begin
  if not public.has_any_role(array['admin', 'coordenacao']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  delete from public.attendance_records where id = p_registro returning * into v_old;
  if not found then
    raise exception 'record not found' using errcode = 'P0002';
  end if;

  insert into alunos.auditoria (usuario, usuario_email, tabela, operacao, registro_id, antes, depois, motivo)
  values (auth.uid(), nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''), 'attendance_records', 'DELETE',
          p_registro::text, alunos.audit_mask(to_jsonb(v_old)), null, btrim(p_motivo));
end $$;

revoke all on function public.corrigir_presenca(uuid, text, text) from public, anon;
revoke all on function public.apagar_presenca(uuid, text) from public, anon;
grant execute on function public.corrigir_presenca(uuid, text, text) to authenticated, service_role;
grant execute on function public.apagar_presenca(uuid, text) to authenticated, service_role;
