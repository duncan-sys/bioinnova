-- BioInnova · Módulo Planta · tabla de Órdenes de Trabajo (OT)
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)

create table if not exists public.bio_ot (
  id           text primary key,
  num          integer,
  fecha        date,
  producto_cod text,
  producto_nom text,
  kg_bolsa     numeric,
  kg           numeric,
  bolsas       integer,
  lote         text,
  cliente      text,
  comercial    text,
  insumos      jsonb default '[]'::jsonb,
  estado       text default 'abierta',
  ts           timestamptz, created_at timestamptz default now()
);

alter table public.bio_ot enable row level security;

-- Mismo criterio que clientes/estancias/visitas.
drop policy if exists bio_ot_all on public.bio_ot;
create policy bio_ot_all on public.bio_ot for all to anon, authenticated using (true) with check (true);
