-- Step 21: public.excluir_checkin(p_id, p_motivo) — the function behind the attendance screen's "Excluir check-in" —
-- documented in the repository AND FIXED. APPLY THIS ONE (it closes a hole in the live version).
--
-- The function was created directly in the Supabase SQL Editor and was not in the repository. This file is the live
-- definition (read from production on 2026-11-07) with ONE correction in the permission check:
--
--   live:   if not (has_any_role(...) or current_papel() = 'equipe') then raise ...
--   fixed:  if not (has_any_role(...) or coalesce(current_papel(), '') = 'equipe') then raise ...
--
-- Why: for a signed-in user who has NO row in allowed_users (e.g. any Google/Microsoft account that signs in and is
-- then rejected by the app), current_papel() is NULL, so `NOT (false OR NULL)` is NULL and the `if` does not raise:
-- the function carried on and DELETED the check-in. Reproduced on a local replica (test 30); the fix is the coalesce.
-- Nothing else changes: same behaviour for staff, same reason rule, same audit row, same grants.
--
-- Behaviour: any staff login (allowed_users.papel = 'equipe') or admin/coordenacao/secretaria may call it; a reason is
-- required; the check-in row is deleted and a full copy goes to alunos.auditoria (antes = the row, depois = {motivo}).
-- The check-in table, its policies and the Edge Function are untouched.
-- Note: public.apagar_presenca (migration 17) does the same but only for admin/coordenacao and fills auditoria.motivo.

create or replace function public.excluir_checkin(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.attendance_records;
begin
  if not (public.has_any_role(array['admin', 'coordenacao', 'secretaria'])
          or coalesce(public.current_papel(), '') = 'equipe') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  delete from public.attendance_records where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'check-in not found' using errcode = 'P0002';
  end if;

  insert into alunos.auditoria (usuario, usuario_email, tabela, operacao, registro_id, antes, depois)
  values (auth.uid(), nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''),
          'attendance_records', 'DELETE', v_row.id::text,
          to_jsonb(v_row), jsonb_build_object('motivo', btrim(p_motivo)));
end $$;

revoke all on function public.excluir_checkin(uuid, text) from public, anon;
grant execute on function public.excluir_checkin(uuid, text) to authenticated, service_role;
