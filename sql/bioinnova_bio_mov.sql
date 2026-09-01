-- BioInnova · Módulo Inventario · movimientos de insumos / materia prima
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)

create table if not exists public.bio_mov (
  id         text primary key,
  insumo_c   text,
  insumo_n   text,
  u          text,             -- unidad: kg | u
  tipo       text,             -- ingreso | egreso | ajuste
  cant       numeric,          -- ingreso/egreso: positivo; ajuste: delta con signo
  motivo     text,
  proveedor  text,
  costo      numeric,
  ot_id      text,             -- si el egreso proviene de una OT producida
  fecha      date,
  usuario    text,
  ts         timestamptz, created_at timestamptz default now()
);

alter table public.bio_mov enable row level security;

-- Mismo criterio que las demás tablas.
drop policy if exists bio_mov_all on public.bio_mov;
create policy bio_mov_all on public.bio_mov for all to authenticated using (true) with check (true);
