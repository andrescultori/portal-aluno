🇺🇸 English | [🇧🇷 Leia em Português](README.md)

# 🎓 Student Portal — UniMissional

**QR-code attendance, institutional content, and admin management in one portal — no more spreadsheets, WhatsApp groups, or loose PDFs for every little thing.**

<div align="center">

[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)

**Author:** [André Scultori](https://github.com/andrescultori)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/andrescultori)

**Started:** September 2026

</div>

---

A complete web portal for UniMissional: Google authentication restricted to an institutional whitelist, QR-code attendance with the status computed server-side, and institutional content (Student Handbook, Google Classroom, Calendar, link sections) managed through an admin panel — all built on React + Supabase (Postgres with RLS), automatically deployed to GitHub Pages on every push.

**Live site:** [andrescultori.github.io/portal-aluno](https://andrescultori.github.io/portal-aluno/) — access is restricted to the institution's whitelist (Google login). To see the internal screens without an authorized account, check the screenshots below.

![Home — module list](screenshots/home.png)

---

## The original problem

Before this portal, every piece of the academic day-to-day lived in a different place:
- Class attendance tracked with no centralized digital record
- Student handbook, Classroom links, and the calendar scattered across email, WhatsApp, and loose PDFs
- No way for staff to update any of that content without asking a developer for help
- No single screen for a student to check their own attendance history

---

## The solution

```
Student signs in with their institutional Google account
        ↓
Supabase (RLS) checks the email against the whitelist — only authorized accounts get in
        ↓
Student scans the QR code fixed in the classroom
        ↓
Edge Function computes present/late/absent server-side, based on the class schedule
        ↓
Staff manage content (Handbook, Classroom, Calendar, links) through the admin panel
        ↓
Everything auto-deploys to GitHub Pages on every push
```

In practice: the student just scans the QR code printed in the classroom to confirm attendance — the system decides, by the server's clock, whether that's on-time, late, or absent, with no way for the student to manipulate the result through their own phone's clock.

**Result:**
- ✅ Attendance **computed server-side**, not client-side — the student never controls the timing
- ✅ Institutional content **100% editable by staff**, with no deploy required
- ✅ Access enforced by **Row Level Security** in Postgres — not just a front-end check
- ✅ Automatic deploy on every push, with no server of its own to maintain

---

## 🛠️ The portal itself

- **Module-based home** — shortcut cards (Handbook, Classroom, Calendar, Attendance, dynamic link sections), each with an icon, title, and subtitle
- **QR-code attendance** — the student only confirms; the status (present/late/absent) is computed entirely server-side from the class schedule
- **Admin panel** — full CRUD for content (hero, handbook, Classroom, link sections, general pages), class management, CSV whitelist import, and an exportable attendance report
- **Academic calendar** — integrated with the Google Calendar API, with a month grid on desktop and a list view on mobile
- **Restricted authentication** — Google login checked against an institutional whitelist; anyone not authorized is blocked before touching any data

![QR-code attendance](screenshots/presenca.png)

---

## 🛠️ Tech Stack

| Category | Tool | Use |
|---|---|---|
| **Frontend** | React + TypeScript + Vite | SPA with `HashRouter` (works on GitHub Pages with no server config) |
| **Styling** | Tailwind CSS v4 | Custom design system with color, radius, and typography tokens |
| **Backend** | Supabase (Postgres) | Database, auth, and access rules via Row Level Security |
| **Server-side logic** | Supabase Edge Functions | Attendance status calculation — never trusted to the client |
| **Deploy** | GitHub Actions | Automatic build and publish to GitHub Pages on every push to `main` |
| **Calendar** | Google Calendar API | Real-time academic events |
| **Icons** | Lucide | Thin-stroke icons across the admin panel and home screen |

---

## A deliberate technical decision: attendance computed server-side, not client-side

The simplest way to build "confirm attendance" would be to let the student's own browser decide the status by comparing the phone's clock to the class schedule, then just insert the record into the database. The problem: a phone's clock is trivially changeable, and any HTTP client could forge a direct insert call to the table.

That's why the client **never** writes to the `attendance_records` table directly — it only calls the `checkin-presenca` Edge Function, which runs server-side, reads the current time from Supabase's own clock (not the student's device), and only then writes the status. The table's RLS policy doesn't even have an `insert` rule for the `authenticated` role — the only way in is the Edge Function, which uses the service role key.

---

## 🔄 Architecture

```
Student (React SPA)
      │
      ▼
Supabase Auth (Google OAuth) ──► allowed_users (RLS: email must be on the whitelist)
      │
      ├──► Postgres (RLS by role: student sees their own, staff sees everything)
      │
      └──► Edge Function checkin-presenca
                │
                ▼
         attendance_records (status computed server-side)
```

### Key files

- [`supabase/schema.sql`](supabase/schema.sql) — full Postgres schema with every RLS policy
- [`supabase/functions/checkin-presenca/index.ts`](supabase/functions/checkin-presenca/index.ts) — Edge Function that computes the attendance status
- [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx) — Supabase session + whitelist check
- [`src/pages/admin`](src/pages/admin) — admin panel (content CRUD, whitelist, report)
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — color, typography, and component tokens for the visual identity
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — build and deploy pipeline

---

## Running locally

```bash
cp .env.example .env   # fill in your Supabase project's URL and anon key
npm install
npm run dev
```

### Setting up your own Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Enable the **Google** provider under Authentication → Providers.
3. Run the contents of [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor — creates the tables, RLS policies, and seed data.
4. Manually insert the first staff user into the `allowed_users` table (a commented example is at the end of `schema.sql`).
5. Deploy the Edge Function: `supabase functions deploy checkin-presenca`.

### Deploy

Automatic via GitHub Actions on every push to `main`. Set these in Settings → Secrets and variables → Actions: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_GOOGLE_CALENDAR_API_KEY`/`VITE_GOOGLE_CALENDAR_ID`. Under Settings → Pages, select **GitHub Actions** as the source.

---

## 📄 License

This project is private and was built exclusively for UniMissional.
The code and architecture are shared here for portfolio purposes.

---

<div align="center">

Built by [André Scultori](https://github.com/andrescultori) · © 2026 · [GitHub](https://github.com/andrescultori/portal-aluno)

</div>
