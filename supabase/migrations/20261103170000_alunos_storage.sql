-- Phase 1A / step 8: private bucket for student photos. Files are served only through
-- signed URLs, which require SELECT access on the object. Path convention:
--   <aluno_id>/<file name>
-- (alunos-documentos will follow the same pattern later.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('alunos-fotos', 'alunos-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function alunos.safe_uuid(t text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid
  end;
$$;
revoke all on function alunos.safe_uuid(text) from public, anon;
grant execute on function alunos.safe_uuid(text) to authenticated, service_role;

drop policy if exists "alunos_fotos_select" on storage.objects;
create policy "alunos_fotos_select" on storage.objects for select to authenticated
  using (bucket_id = 'alunos-fotos'
         and public.can_view_aluno(alunos.safe_uuid((storage.foldername(name))[1])));

drop policy if exists "alunos_fotos_insert" on storage.objects;
create policy "alunos_fotos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'alunos-fotos'
              and (alunos.safe_uuid((storage.foldername(name))[1]) = alunos.my_aluno_id()
                   or public.has_any_role(array['admin', 'coordenacao', 'secretaria'])));

drop policy if exists "alunos_fotos_update" on storage.objects;
create policy "alunos_fotos_update" on storage.objects for update to authenticated
  using (bucket_id = 'alunos-fotos'
         and (alunos.safe_uuid((storage.foldername(name))[1]) = alunos.my_aluno_id()
              or public.has_any_role(array['admin', 'coordenacao', 'secretaria'])));

drop policy if exists "alunos_fotos_delete" on storage.objects;
create policy "alunos_fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'alunos-fotos'
         and (alunos.safe_uuid((storage.foldername(name))[1]) = alunos.my_aluno_id()
              or public.has_any_role(array['admin', 'coordenacao', 'secretaria'])));
