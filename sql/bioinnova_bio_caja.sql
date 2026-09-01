-- BioInnova · Módulo Caja Chica (efectivo de planta, guaraníes)
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)

create table if not exists public.bio_caja (
  id          text primary key,
  tipo        text,             -- ingreso | egreso
  monto       numeric,
  fecha       date,
  concepto    text,
  categoria   text,
  proveedor   text,
  factura     text,
  responsable text,
  obs         text,
  por         text,
  ts          timestamptz, created_at timestamptz default now()
);

alter table public.bio_caja enable row level security;

-- Mismo criterio que las demás tablas.
drop policy if exists bio_caja_all on public.bio_caja;
create policy bio_caja_all on public.bio_caja for all to authenticated using (true) with check (true);
