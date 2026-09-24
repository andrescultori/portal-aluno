🇧🇷 Português | [🇺🇸 English](README.en.md)

# 🎓 Portal do Aluno — UniMissional

**Presença por QR Code, conteúdo institucional e administração num só portal — sem depender de planilha, grupo de WhatsApp ou PDF avulso pra cada coisa.**

<div align="center">

[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)

**Autor:** [André Scultori](https://github.com/andrescultori)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/andrescultori)

**Início:** Setembro 2026

</div>

---

Portal web completo para a UniMissional: autenticação Google restrita a uma whitelist institucional, presença via QR Code com status calculado no servidor, e conteúdo (Manual do Aluno, Google Classroom, Calendário, seções de links) gerenciado por um painel admin — tudo em React + Supabase (Postgres com RLS), publicado automaticamente no GitHub Pages a cada push.

**Site:** [andrescultori.github.io/portal-aluno](https://andrescultori.github.io/portal-aluno/) — acesso restrito à whitelist da instituição (login via Google). Pra ver as telas internas sem precisar de uma conta autorizada, veja os screenshots abaixo.

![Home — lista de módulos](screenshots/home.png)

---

## O problema original

Antes deste portal, cada parte do dia a dia acadêmico vivia num lugar diferente:
- Presença em aula controlada sem registro digital centralizado
- Manual do aluno, links do Classroom e calendário espalhados entre e-mail, WhatsApp e PDFs soltos
- Nenhum jeito de a equipe atualizar esse conteúdo sem pedir ajuda de quem programa
- Nenhuma tela única pro aluno acompanhar o próprio histórico de presença

---

## A solução

```
Aluno faz login com a conta Google institucional
        ↓
Supabase (RLS) valida o e-mail contra a whitelist — só quem está autorizado entra
        ↓
Aluno escaneia o QR Code fixo em sala
        ↓
Edge Function calcula presente/atraso/falta no servidor, pelo horário da turma
        ↓
Conteúdo (Manual, Classroom, Calendário, links) é gerenciado pela equipe no painel admin
        ↓
Tudo publicado automaticamente no GitHub Pages a cada push
```

Na prática: o aluno só escaneia o QR Code impresso em sala pra confirmar presença — o sistema decide sozinho, pelo horário do servidor, se é presença, atraso ou falta, sem o aluno poder manipular o resultado pelo relógio do próprio celular.

**Resultado:**
- ✅ Presença **calculada no servidor**, não no cliente — o aluno não controla o próprio horário
- ✅ Conteúdo institucional **100% editável pela equipe**, sem precisar de deploy
- ✅ Acesso restrito por **Row Level Security** no Postgres — não só checagem no front-end
- ✅ Deploy automático a cada push, sem servidor próprio pra manter

---

## 🛠️ O portal em si

- **Home em módulos** — lista de atalhos (Manual, Classroom, Calendário, Presença, seções de links dinâmicas) com ícone, título e subtítulo
- **Presença por QR Code** — o aluno só confirma; o status (presente/atraso/falta) é calculado 100% no servidor a partir do horário da turma
- **Painel admin** — CRUD completo de conteúdo (hero, manual, Classroom, seções de links, páginas gerais), gestão de turmas, importação de whitelist via CSV e relatório de presença exportável
- **Calendário acadêmico** — integrado à API do Google Calendar, com grade mensal no desktop e lista no mobile
- **Autenticação restrita** — login Google validado contra uma whitelist institucional; quem não está autorizado é bloqueado antes de qualquer acesso a dado

![Presença via QR Code](screenshots/presenca.png)

---

## 🛠️ Stack Técnica

| Categoria | Ferramenta | Uso |
|---|---|---|
| **Frontend** | React + TypeScript + Vite | SPA com `HashRouter` (compatível com GitHub Pages sem configuração de servidor) |
| **Estilo** | Tailwind CSS v4 | Design system próprio com tokens de cor, raio e tipografia |
| **Backend** | Supabase (Postgres) | Banco, autenticação e regras de acesso via Row Level Security |
| **Lógica de servidor** | Supabase Edge Functions | Cálculo do status de presença — nunca confiado ao client |
| **Deploy** | GitHub Actions | Build e publicação automática no GitHub Pages a cada push em `main` |
| **Calendário** | Google Calendar API | Eventos acadêmicos em tempo real |
| **Ícones** | Lucide | Ícones de traço fino no painel admin e na Home |

---

## Uma decisão técnica: presença calculada no servidor, não no cliente

O jeito mais simples de implementar "confirmar presença" seria o próprio navegador do aluno decidir o status comparando a hora do celular com o horário da turma, e simplesmente inserir o registro no banco. O problema: hora de celular se altera facilmente, e qualquer cliente HTTP poderia forjar uma chamada de insert direto pra tabela.

Por isso o cliente **nunca** escreve na tabela `attendance_records` diretamente — só chama a Edge Function `checkin-presenca`, que roda no servidor, calcula o horário atual a partir do relógio do Supabase (não do dispositivo do aluno) e só então grava o status. A política de RLS da tabela nem tem uma regra de `insert` para o papel `authenticated` — a única porta de entrada é a Edge Function, que usa a service role key.

---

## 🔄 Arquitetura

```
Aluno (React SPA)
      │
      ▼
Supabase Auth (Google OAuth) ──► allowed_users (RLS: e-mail precisa estar na whitelist)
      │
      ├──► Postgres (RLS por papel: aluno vê o próprio, equipe vê tudo)
      │
      └──► Edge Function checkin-presenca
                │
                ▼
         attendance_records (status calculado no servidor)
```

### Arquivos-chave

- [`supabase/schema.sql`](supabase/schema.sql) — schema completo do Postgres com todas as políticas de RLS
- [`supabase/functions/checkin-presenca/index.ts`](supabase/functions/checkin-presenca/index.ts) — Edge Function que calcula o status de presença
- [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx) — sessão Supabase + checagem contra a whitelist
- [`src/pages/admin`](src/pages/admin) — painel administrativo (CRUD de conteúdo, whitelist, relatório)
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — tokens de cor, tipografia e componentes da identidade visual
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — pipeline de build e deploy

---

## Rodando localmente

```bash
cp .env.example .env   # preencha com a URL e a anon key do seu projeto Supabase
npm install
npm run dev
```

### Configurar um Supabase próprio

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Ative o provider **Google** em Authentication → Providers.
3. Rode o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor — cria as tabelas, o RLS e os dados iniciais.
4. Insira o primeiro usuário da equipe manualmente na tabela `allowed_users` (exemplo comentado no fim do `schema.sql`).
5. Publique a Edge Function: `supabase functions deploy checkin-presenca`.

### Deploy

Automático via GitHub Actions a cada push em `main`. Configure em Settings → Secrets and variables → Actions: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, e opcionalmente `VITE_GOOGLE_CALENDAR_API_KEY`/`VITE_GOOGLE_CALENDAR_ID`. Em Settings → Pages, selecione a fonte **GitHub Actions**.

---

## 📄 Licença

Este projeto é privado e desenvolvido exclusivamente para a UniMissional.
O código e a arquitetura são compartilhados para fins de portfólio.

---

<div align="center">

Desenvolvido por [André Scultori](https://github.com/andrescultori) · © 2026 · [GitHub](https://github.com/andrescultori/portal-aluno)

</div>
