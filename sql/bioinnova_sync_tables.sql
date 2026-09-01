-- ═══════════════════════════════════════════════════════════
-- BioInnova — Tablas para sincronización en la nube
-- Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════

create table if not exists public.clientes (
  id text primary key,
  nombre text, contacto text, tel text, email text, ubicacion text, obs text,
  ts timestamptz, created_at timestamptz default now()
);

create table if not exists public.estancias (
  id text primary key,
  cliente_id text, nombre text, zona text,
  hato jsonb, lotes jsonb, obs text,
  ts timestamptz, created_at timestamptz default now()
);

create table if not exists public.visitas (
  id text primary key,
  cliente_id text, estancia_id text,
  fecha date, tecnico text,
  evaluaciones jsonb,   -- [{categoria,lote,producto,presentacion,consumo,dias_sistema,n_animales,kpis[],comentario}]
  diagnostico text, recomendacion text, proxima date,
  ts timestamptz, created_at timestamptz default now()
);

alter table public.clientes  enable row level security;
alter table public.estancias enable row level security;
alter table public.visitas   enable row level security;

drop policy if exists clientes_all  on public.clientes;
drop policy if exists estancias_all on public.estancias;
drop policy if exists visitas_all   on public.visitas;

create policy clientes_all  on public.clientes  for all to authenticated using (true) with check (true);
create policy estancias_all on public.estancias for all to authenticated using (true) with check (true);
create policy visitas_all   on public.visitas   for all to authenticated using (true) with check (true);

-- Por si la tabla visitas se creó antes con el esquema plano (categoria/lote/kpis):
alter table public.visitas add column if not exists evaluaciones jsonb;
