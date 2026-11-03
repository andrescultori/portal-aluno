-- Phase 1A / step 5: enrollments per semester and cycle status.
-- (Phase 2 will make the check-in create the first `matriculas` row; registrar_checkin is untouched now.)

create table if not exists alunos.matriculas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos.alunos (id) on delete cascade,
  semestre_id uuid not null references alunos.semestres (id) on delete restrict,
  ciclo_id int references alunos.ciclos (id),
  modulo_id int references alunos.modulos (id),
  cenario text,
  plano text references alunos.planos (codigo),
  alimentacao text,
  moradia text,
  academia text,
  status text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (aluno_id, semestre_id)
);
create index if not exists matriculas_semestre_ix on alunos.matriculas (semestre_id);

create table if not exists alunos.ciclo_status (
  aluno_id uuid not null references alunos.alunos (id) on delete cascade,
  ciclo_id int not null references alunos.ciclos (id),
  status text not null check (status in ('Completo', 'Incompleto', 'Cursando', 'Não cursou')),
  atualizado_em timestamptz not null default now(),
  primary key (aluno_id, ciclo_id)
);

alter table alunos.matriculas enable row level security;
alter table alunos.ciclo_status enable row level security;
revoke all on alunos.matriculas, alunos.ciclo_status from anon;

drop trigger if exists trg_matriculas_touch on alunos.matriculas;
create trigger trg_matriculas_touch before update on alunos.matriculas
  for each row execute function selecao.touch_atualizado_em();
drop trigger if exists trg_ciclo_status_touch on alunos.ciclo_status;
create trigger trg_ciclo_status_touch before update on alunos.ciclo_status
  for each row execute function selecao.touch_atualizado_em();
