-- Conteo físico mensual (BioInnova · Inventario / Productos → 🧮 Conteo físico).
-- Pegar TODO en Supabase → proyecto de BioInnova (mnuldrgy…) → SQL Editor → Run.
-- Idempotente: se puede correr más de una vez.

create table if not exists public.bio_conteos (
  id           text primary key,
  tipo         text default 'insumos',      -- insumos · pt (producto terminado)
  fecha        date,
  estado       text default 'abierto',      -- abierto · enviado · aprobado
  lineas       jsonb default '[]'::jsonb,    -- ítem, stock sistema, físico, explicación, comprobantes
  creado_por   text,
  enviado_por  text,
  aprobado_por text,
  aprobado_ts  timestamptz,
  obs          text,
  ts           timestamptz
);

-- Igual que el resto de las tablas: sólo usuarios con sesión iniciada.
alter table public.bio_conteos enable row level security;
drop policy if exists bio_conteos_auth on public.bio_conteos;
create policy bio_conteos_auth on public.bio_conteos for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';

select 'bio_conteos lista' as estado, count(*) as conteos from public.bio_conteos;
