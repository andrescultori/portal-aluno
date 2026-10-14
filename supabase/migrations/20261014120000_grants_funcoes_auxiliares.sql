-- Grants explícitos em current_papel() / current_aluno_id().
-- A migration 20261007120000 tirou o acesso de public/anon a essas funções, mas
-- não concedeu nada a authenticated: se o acesso de authenticated vinha só do
-- grant implícito a PUBLIC (ex.: projeto restaurado sem os privilégios padrão),
-- toda policy de RLS que chama essas funções passaria a falhar com
-- "permission denied for function". Idempotente: não muda nada se já existir.

grant execute on function public.current_aluno_id() to authenticated, service_role;
grant execute on function public.current_papel()    to authenticated, service_role;
