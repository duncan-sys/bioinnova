-- BioInnova · Informe semanal del comercial
-- Ejecutar en Supabase → SQL Editor.
--
-- El informe NO guarda la actividad de la semana: esa se recalcula desde
-- visitas, clientes, cotizaciones y ventas cada vez que se abre la pantalla.
-- Acá sólo va lo que el comercial escribe y la firma de cierre.

create table if not exists public.bio_semanales (
  id           text primary key,   -- SE-<lunes>-<comercial normalizado>
  semana       text,               -- lunes de la semana, ISO (YYYY-MM-DD)
  comercial    text,               -- nombre tal como se mostró al cerrar
  comercial_id text,               -- id del usuario; vacío si no se pudo atar
  dias         jsonb,              -- { "YYYY-MM-DD": "nota libre del día" }
  destacado    text,               -- lo más importante de la semana
  trabas       text,               -- qué lo frenó / en qué necesita ayuda
  plan         text,               -- plan de la semana siguiente
  cerrado      timestamptz,        -- null o vacío = borrador
  ts           timestamptz, created_at timestamptz default now()
);

create index if not exists bio_semanales_semana_idx on public.bio_semanales (semana);

alter table public.bio_semanales enable row level security;

-- Mismo criterio que las demás tablas: cualquier usuario con sesión.
-- El control de quién ve qué lo hace la app por rol (el comercial ve el suyo,
-- gerencia ve el de todos).
drop policy if exists bio_semanales_all on public.bio_semanales;
create policy bio_semanales_all on public.bio_semanales for all to authenticated using (true) with check (true);
