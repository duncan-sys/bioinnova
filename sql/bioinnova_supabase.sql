-- ═══════════════════════════════════════════════════════════
-- BioInnova — Supabase: tabla de perfiles (usuarios y roles)
-- Pegar TODO en Supabase → SQL Editor → New query → Run
-- Correr DESPUÉS de crear tu usuario en Authentication → Users.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.perfiles (
  id         uuid primary key,
  email      text,
  nombre     text,
  rol        text default 'lectura',   -- gerente | tecnico | lectura
  activo     boolean default true,
  created_at timestamptz default now()
);

alter table public.perfiles enable row level security;

drop policy if exists perfiles_all on public.perfiles;
create policy perfiles_all on public.perfiles
  for all to authenticated using (true) with check (true);

-- Bootstrap: convierte tu cuenta en GERENTE (toma el uuid de auth.users por email)
insert into public.perfiles (id, email, nombre, rol)
select id, email, 'Martín Miranda', 'gerente'
from auth.users
where email = 'martinpa1975@gmail.com'
on conflict (id) do update set rol = 'gerente', nombre = 'Martín Miranda', activo = true;
