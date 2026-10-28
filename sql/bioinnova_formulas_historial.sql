-- ═══════════════════════════════════════════════════════════════════════════
-- BioInnova · Historial de versiones de las fórmulas
-- Proyecto Supabase: mnuldrgynighabwtulkf
-- Pegar TODO en Supabase → SQL Editor → New query → Run
--
-- POR QUÉ
--   Desde la v154, al cambiar una fórmula la receta anterior queda guardada
--   (fecha, quién la cambió, insumos y %). Se guarda en la columna "hist" de
--   bio_formulas. Hasta correr esto, el historial queda sólo en el equipo
--   donde se hizo el cambio y esa fórmula figura pendiente de sincronizar;
--   apenas exista la columna se sube sola.
--
-- NO reabre la base al anónimo: acá no se tocan políticas.
-- Es seguro correrlo más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bio_formulas add column if not exists hist jsonb;  -- versiones anteriores, la más reciente primero


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr esto después. Se espera 1 fila: hist | jsonb
-- ═══════════════════════════════════════════════════════════════════════════
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'bio_formulas'
  and column_name  = 'hist';
