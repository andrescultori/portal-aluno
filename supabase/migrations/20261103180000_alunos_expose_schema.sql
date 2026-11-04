-- Phase 1A / step 9: expose the `alunos` schema in the Data API so the front end can query it.
-- Same effect as Dashboard > Project Settings > API > Exposed schemas.
-- Run this LAST, after the RLS migration, so nothing is reachable before it is protected.
--
-- Live value before this migration (read-only inspection, 2026-11-03):
--   public, graphql_public, propostas, selecao
-- The guard below aborts if the live value is anything else, so a manual change made in the
-- meantime is never overwritten silently.

do $$
declare
  v_current text;
begin
  select substring(c from '^pgrst\.db_schemas=(.*)$') into v_current
    from pg_roles r, unnest(r.rolconfig) c
   where r.rolname = 'authenticator' and c like 'pgrst.db_schemas=%';

  if v_current is distinct from 'public, graphql_public, propostas, selecao'
     and v_current is distinct from 'public, graphql_public, propostas, selecao, alunos' then
    raise exception 'Unexpected pgrst.db_schemas on authenticator: %', coalesce(v_current, '<not set>');
  end if;
end $$;

alter role authenticator set pgrst.db_schemas = 'public, graphql_public, propostas, selecao, alunos';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
