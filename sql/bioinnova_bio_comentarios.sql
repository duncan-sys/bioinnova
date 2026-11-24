-- Comentarios del gerente al comercial (BioInnova · tablero del comercial).
-- Pegar TODO en Supabase → proyecto de BioInnova (mnuldrgy…) → SQL Editor → Run. Idempotente.
create table if not exists public.bio_comentarios (
  id           text primary key,
  comercial    text,
  de           text,
  tipo         text default 'sugerencia',   -- reconocimiento · sugerencia · atencion
  texto        text,
  cliente_id   text,
  cliente_nom  text,
  fecha        date,
  leido_ts     timestamptz,
  respuesta    text,
  respuesta_ts timestamptz,
  ts           timestamptz
);
alter table public.bio_comentarios enable row level security;
drop policy if exists bio_comentarios_auth on public.bio_comentarios;
create policy bio_comentarios_auth on public.bio_comentarios for all to authenticated using (true) with check (true);
notify pgrst, 'reload schema';
select 'bio_comentarios lista' as estado, count(*) as comentarios from public.bio_comentarios;
