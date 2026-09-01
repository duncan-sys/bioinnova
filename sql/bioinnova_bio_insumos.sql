-- BioInnova · Inventario · insumos cargados por el gerente (además de los de fórmulas)
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)

create table if not exists public.bio_insumos (
  id    text primary key,
  c     text,             -- código del insumo
  n     text,             -- nombre
  prov  text,             -- proveedor
  u     text,             -- unidad: kg | u
  cat   text,             -- Materia prima | Envase | Etiqueta | Otro
  ts    timestamptz, created_at timestamptz default now()
);

alter table public.bio_insumos enable row level security;

drop policy if exists bio_insumos_all on public.bio_insumos;
create policy bio_insumos_all on public.bio_insumos for all to authenticated using (true) with check (true);
