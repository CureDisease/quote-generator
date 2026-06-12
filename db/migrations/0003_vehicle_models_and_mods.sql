-- Phase 5C — vehicle model library + workshop modifications.
-- Apply via the Supabase MCP (apply_migration) or the SQL editor.

create table if not exists public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  label text not null,
  make text not null default '',
  model text not null default '',
  variant text not null default '',
  is_trailer boolean not null default false,
  length_ft numeric not null default 20,
  width_ft numeric not null default 8,
  height_ft numeric not null default 9.5,
  cab_length_ft numeric not null default 4,
  wheelbase_ft numeric not null default 12,
  axle_positions numeric[] not null default '{}',
  gvwr_lbs numeric not null default 0,
  cut_zones jsonb not null default '[]'::jsonb,
  notes text not null default '',
  active boolean not null default true
);
create unique index if not exists vehicle_models_label_idx on public.vehicle_models (lower(label));
alter table public.vehicle_models enable row level security;
drop policy if exists "vehicle_models_all" on public.vehicle_models;
create policy "vehicle_models_all" on public.vehicle_models for all to public using (true) with check (true);

create table if not exists public.workshop_mods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  category text not null default 'exterior',
  unit_price numeric not null default 0,
  labor_hours numeric not null default 0,
  allowed_zones text[] not null default '{}',
  notes text not null default '',
  active boolean not null default true
);
create unique index if not exists workshop_mods_name_idx on public.workshop_mods (lower(name));
alter table public.workshop_mods enable row level security;
drop policy if exists "workshop_mods_all" on public.workshop_mods;
create policy "workshop_mods_all" on public.workshop_mods for all to public using (true) with check (true);

alter table public.quotes add column if not exists vehicle_model_id uuid references public.vehicle_models(id) on delete set null;
