-- ═══════════════════════════════════════════════════════════════════════════
-- BioInnova · Las tres columnas que le faltan a bio_mov
-- Proyecto Supabase: mnuldrgynighabwtulkf
-- Pegar TODO en Supabase → SQL Editor → New query → Run
--
-- POR QUÉ
--   Los movimientos de inventario guardan el costo en guaraníes, pero cuando la
--   compra fue en dólares la app también manda la moneda original, el costo en esa
--   moneda y el tipo de cambio usado. Esas tres columnas nunca se crearon.
--   La app no falla: el sync detecta el rechazo y reintenta sin ellas (toRowSafe),
--   así que el movimiento se guarda igual — pero la moneda original y el TC se
--   PIERDEN, y en otro equipo el movimiento aparece como si hubiera sido en ₲.
--   Detectado el 2026-09-29 por el chequeo de esquema nuevo (verificarEsquema).
--
-- NO reabre la base al anónimo: acá no se tocan políticas.
-- Es seguro correrlo más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bio_mov add column if not exists moneda     text;     -- PYG | USD
alter table public.bio_mov add column if not exists costo_orig numeric;  -- costo en la moneda original
alter table public.bio_mov add column if not exists tc         numeric;  -- tipo de cambio usado

-- Los movimientos ya cargados quedan como guaraníes, que es lo que se asumía hasta ahora.
update public.bio_mov set moneda = 'PYG' where moneda is null;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr esto después. Se esperan las 3 filas.
-- ═══════════════════════════════════════════════════════════════════════════
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'bio_mov'
  and column_name in ('moneda', 'costo_orig', 'tc')
order by column_name;
