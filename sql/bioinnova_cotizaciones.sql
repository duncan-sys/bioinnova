-- BioInnova · Módulo Cotizaciones (lista de precios + cotizaciones)
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)

-- Ediciones/altas de la lista de precios (por el gerente). La base va embebida en la app.
create table if not exists public.bio_precios (
  id      text primary key,
  c       text,            -- código
  n       text,            -- nombre
  kg      numeric,         -- kg por bolsa
  p0      numeric,         -- ₲/kg contado
  p30     numeric,         -- crédito 30
  p60     numeric,         -- crédito 60
  p90     numeric,         -- crédito 90
  borrado boolean default false,
  ts      timestamptz, created_at timestamptz default now()
);
alter table public.bio_precios enable row level security;
drop policy if exists bio_precios_all on public.bio_precios;
create policy bio_precios_all on public.bio_precios for all to anon, authenticated using (true) with check (true);

-- Cotizaciones emitidas
create table if not exists public.bio_cotiz (
  id         text primary key,
  num        integer,
  fecha      date,
  cliente    text,
  cliente_id text,
  condicion  text,         -- p0 | p30 | p60 | p90
  moneda     text,         -- PYG | USD
  dolar      numeric,
  validez    integer,
  vendedor   text,
  items      jsonb default '[]'::jsonb,  -- [{key,nombre,kg_bolsa,precio_kg,unidad,cantidad,kg,subtotal}]
  subtotal   numeric,       -- suma de productos (sin flete)
  flete      numeric,       -- flete del pedido (editable por cotización)
  total      numeric,       -- subtotal + flete
  obs        text,
  por        text,
  ts         timestamptz, created_at timestamptz default now()
);
alter table public.bio_cotiz enable row level security;
drop policy if exists bio_cotiz_all on public.bio_cotiz;
create policy bio_cotiz_all on public.bio_cotiz for all to anon, authenticated using (true) with check (true);
