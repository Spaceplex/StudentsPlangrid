create extension if not exists pgcrypto;

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sheets (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  pdf_key text not null,
  canvas_size text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.sheets(id) on delete cascade,
  name text not null,
  description text not null default '',
  x_coord double precision not null,
  y_coord double precision not null,
  color text not null default '#FF0000',
  status text not null default 'open',
  created_by text not null,
  assigned_to text,
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by text not null,
  file_key text not null,
  original_name text not null,
  media_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists sheets_building_id_idx on public.sheets(building_id);
create index if not exists tasks_sheet_id_idx on public.tasks(sheet_id);
create index if not exists attachments_task_id_idx on public.attachments(task_id);
