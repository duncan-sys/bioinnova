-- BioInnova · overrides de acceso por usuario (además del rol)
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)

alter table public.perfiles add column if not exists accesos jsonb;
-- accesos = { "modulo": true|false }  (presente = anula el default del rol)
-- módulos: visita, clientes, historial, crm, viaticos, ot, formulas, inventario, caja, usuarios
