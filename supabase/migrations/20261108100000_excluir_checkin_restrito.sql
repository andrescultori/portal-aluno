-- Step 22 (owner's decision): who may delete a check-in, and retire the duplicate function.
--
-- 1. public.excluir_checkin(p_id, p_motivo) — the one the attendance screen calls — is restricted to the roles
--    admin, coordenacao and tutor (staff_roles). Before, ANY staff login (allowed_users.papel = 'equipe') could,
--    including mentors, secretaria and financeiro. has_any_role() never returns NULL, so the NULL hole closed by
--    migration 21 cannot come back through this check. Everything else is unchanged (a reason is required, the row
--    is deleted, a full copy goes to alunos.auditoria); the reason is now ALSO stored in auditoria.motivo (as the
--    attendance corrections do), besides depois = {motivo} which is kept.
-- 2. public.apagar_presenca (migration 17) did the same job for admin/coordenacao and nothing calls it any more:
--    retired (dropped). It deleted no data by itself; the audit rows it may have written stay.
-- The check-in table, its policies and the Edge Function are untouched.

create or replace function public.excluir_checkin(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.attendance_records;
begin
  if not public.has_any_role(array['admin', 'coordenacao', 'tutor']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  delete from public.attendance_records where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'check-in not found' using errcode = 'P0002';
  end if;

  insert into alunos.auditoria (usuario, usuario_email, tabela, operacao, registro_id, antes, depois, motivo)
  values (auth.uid(), nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''),
          'attendance_records', 'DELETE', v_row.id::text,
          to_jsonb(v_row), jsonb_build_object('motivo', btrim(p_motivo)), btrim(p_motivo));
end $$;

revoke all on function public.excluir_checkin(uuid, text) from public, anon;
grant execute on function public.excluir_checkin(uuid, text) to authenticated, service_role;

drop function if exists public.apagar_presenca(uuid, text);
