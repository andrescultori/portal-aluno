-- Phase 1A / step 9: expose the `alunos` schema in the Data API so the front end can query it.
-- Same effect as Dashboard > Project Settings > API > Exposed schemas.
-- Run this LAST, after the RLS migration, so nothing is reachable before it is protected.

alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, propostas, selecao, alunos';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
