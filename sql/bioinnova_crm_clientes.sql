-- BioInnova · CRM integrado — columnas nuevas en la tabla clientes
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)

alter table public.clientes add column if not exists codigo        text;  -- código SAP
alter table public.clientes add column if not exists estado        text;
alter table public.clientes add column if not exists prioridad     text;
alter table public.clientes add column if not exists comercial     text;
alter table public.clientes add column if not exists prox_fecha    date;
alter table public.clientes add column if not exists prox_nota     text;
alter table public.clientes add column if not exists seguimientos  jsonb default '[]'::jsonb;
-- seguimientos: [{id,fecha,tipo,nota,por}]
