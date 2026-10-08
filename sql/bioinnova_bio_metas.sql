-- Metas de facturación por comercial y por año.
-- Una fila por comercial por año; los 12 meses van en un array jsonb.
-- Son pocas filas (nº de comerciales × años), así que no pesa en el egress.

create table if not exists public.bio_metas (
  id        text primary key,
  comercial text not null default '',
  anio      integer not null default 0,
  meses     jsonb   not null default '[]'::jsonb,
  ts        bigint
);

alter table public.bio_metas enable row level security;

-- Igual que el resto de las tablas: solo usuarios autenticados.
-- (No usar `to anon` — ver la nota del 01/09/2026: las políticas permisivas se
--  suman y una sola con anon reabre la tabla al público.)
drop policy if exists bio_metas_all on public.bio_metas;
create policy bio_metas_all on public.bio_metas
  for all to authenticated using (true) with check (true);

create index if not exists bio_metas_anio_idx on public.bio_metas (anio);
