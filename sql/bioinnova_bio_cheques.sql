-- BioInnova · Cheques diferidos (pago a proveedores)
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)
-- Sin esta tabla los cheques quedan SOLO en el equipo donde se cargaron:
-- no suben a la nube y los demás usuarios no los ven en el flujo.

create table if not exists public.bio_cheques (
  id          text primary key,
  proveedor   text,
  compra_id   text,             -- cuenta a pagar que cancela (opcional)
  factura     text,
  banco       text,
  num         text,
  monto       numeric,
  moneda      text,             -- PYG | USD
  tc          numeric,
  fecha       date,             -- fecha de caída (cuando sale la plata)
  emitido     date,
  estado      text,             -- pendiente | caido
  nota        text,
  por         text,
  ts          timestamptz, created_at timestamptz default now()
);

alter table public.bio_cheques enable row level security;

-- Mismo criterio que las demás tablas.
drop policy if exists bio_cheques_all on public.bio_cheques;
create policy bio_cheques_all on public.bio_cheques for all to anon, authenticated using (true) with check (true);
