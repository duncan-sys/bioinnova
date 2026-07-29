-- BioInnova · Motor de costeo — precios de insumos + parámetros
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)

-- Precios ₲/kg de insumos (los actualiza Guillermo)
create table if not exists public.bio_insprec (
  id   text primary key,
  c    text,            -- código insumo
  gskg numeric,         -- ₲/kg
  ts   timestamptz, created_at timestamptz default now()
);
alter table public.bio_insprec enable row level security;
drop policy if exists bio_insprec_all on public.bio_insprec;
create policy bio_insprec_all on public.bio_insprec for all to anon, authenticated using (true) with check (true);

-- Config general (fila única id='pricing' con {costcfg, margen})
create table if not exists public.bio_config (
  id   text primary key,
  data jsonb,
  ts   timestamptz, created_at timestamptz default now()
);
alter table public.bio_config enable row level security;
drop policy if exists bio_config_all on public.bio_config;
create policy bio_config_all on public.bio_config for all to anon, authenticated using (true) with check (true);
