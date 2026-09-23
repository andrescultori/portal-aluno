# Portal do Aluno — UniMissional

Portal do aluno com autenticação Google, presença via QR Code, manual do
aluno, Google Classroom, calendário acadêmico e área de administração.
Frontend estático (React + Vite + Tailwind) publicado no GitHub Pages;
backend no Supabase (Postgres, Auth, Storage, Edge Functions).

## Stack

- React + TypeScript + Vite + Tailwind CSS v4
- React Router (`HashRouter`, compatível com GitHub Pages sem configuração extra)
- Supabase JS SDK (Auth com Google OAuth, Postgres com RLS, Edge Functions)
- GitHub Actions para build e deploy no GitHub Pages

## Configuração do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Ative o provider **Google** em Authentication → Providers, com as
   credenciais OAuth do Google Cloud.
3. Rode o conteúdo de `supabase/schema.sql` no SQL Editor do projeto — cria
   as tabelas, as políticas de RLS e os dados iniciais.
4. Insira o primeiro usuário da equipe manualmente na tabela
   `allowed_users` (há um exemplo comentado no fim do `schema.sql`) para
   conseguir acessar a área `/admin` e cadastrar o restante da whitelist
   por lá.
5. Publique a Edge Function de presença:
   ```bash
   supabase functions deploy checkin-presenca
   ```
   Ela usa as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY`, já disponíveis automaticamente no ambiente
   de Edge Functions do Supabase.

## Desenvolvimento local

```bash
cp .env.example .env   # preencha com a URL e a anon key do seu projeto Supabase
npm install
npm run dev
```

## Build e deploy

O deploy é automático via GitHub Actions (`.github/workflows/deploy.yml`)
a cada push na branch `main`, publicando `dist/` no GitHub Pages.

Configure em Settings → Secrets and variables → Actions do repositório:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_CALENDAR_API_KEY` (opcional, calendário fica em modo mock sem ela)
- `VITE_GOOGLE_CALENDAR_ID` (opcional)

E em Settings → Pages, selecione a fonte **GitHub Actions**.

Se o nome do repositório for diferente de `portal-aluno`, ajuste o `base`
em `vite.config.ts`.

## Estrutura

- `src/pages` — páginas públicas (autenticadas) do portal
- `src/pages/admin` — CRUD de conteúdo, whitelist e relatório de presença (papel `equipe`)
- `src/contexts/AuthContext.tsx` — sessão Supabase + checagem contra `allowed_users`
- `supabase/schema.sql` — schema completo do Postgres com RLS
- `supabase/functions/checkin-presenca` — Edge Function que calcula o
  status de presença no servidor (o client nunca grava direto na tabela)
