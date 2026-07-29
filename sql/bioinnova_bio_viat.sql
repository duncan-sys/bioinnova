-- BioInnova · Módulo Rendición de Viáticos (comerciales)
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)

create table if not exists public.bio_viat (
  id             text primary key,
  comercial      text,
  desde          date,
  hasta          date,
  anticipo       numeric,
  anticipo_fecha date,
  anticipo_ref   text,
  gastos         jsonb default '[]'::jsonb,   -- [{id,fecha,categoria,concepto,proveedor,factura,monto}]
  estado         text default 'abierta',      -- abierta | rendida | liquidada
  liq_fecha      date,
  liq_ref        text,
  por            text,
  ts             timestamptz, created_at timestamptz default now()
);

alter table public.bio_viat enable row level security;

-- Mismo criterio que las demás tablas.
drop policy if exists bio_viat_all on public.bio_viat;
create policy bio_viat_all on public.bio_viat for all to anon, authenticated using (true) with check (true);
