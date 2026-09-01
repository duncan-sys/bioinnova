-- ═══════════════════════════════════════════════════════════════════════════
-- BioInnova · Las cuatro columnas que le faltan a bio_cotiz
-- Proyecto Supabase: mnuldrgynighabwtulkf
-- Pegar TODO en Supabase → SQL Editor → New query → Run
--
-- POR QUÉ
--   Cuando margen y flete pasaron a ser campos de la cotización, se agregaron
--   al SQL del módulo — pero ese archivo arranca con "create table if not
--   exists" y la tabla ya estaba creada, así que el ALTER nunca ocurrió.
--   Hoy la app guarda la cotización igual: el sync detecta el rechazo y
--   reintenta sin esas columnas (toRowSafe). El total y el precio por kg de
--   cada ítem se conservan, pero el margen y el flete se pierden — al abrir
--   la cotización en otro equipo vuelven al valor por defecto.
--
-- NO reabre la base al anónimo: acá no se tocan políticas.
-- Es seguro correrlo más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bio_cotiz add column if not exists margen   numeric;  -- % de margen de esta cotización (input, no se imprime)
alter table public.bio_cotiz add column if not exists subtotal numeric;  -- suma de los ítems, antes del flete
alter table public.bio_cotiz add column if not exists flete_kg numeric;  -- flete ₲/kg (input, no se imprime; ya va dentro de precio_kg)
alter table public.bio_cotiz add column if not exists flete    numeric;  -- flete total del pedido


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr esto después.
-- Se esperan las 4 filas. Si falta alguna, el ALTER de arriba no se aplicó.
-- ═══════════════════════════════════════════════════════════════════════════
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'bio_cotiz'
  and column_name in ('margen', 'subtotal', 'flete_kg', 'flete')
order by column_name;
