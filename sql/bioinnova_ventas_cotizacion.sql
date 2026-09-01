-- ═══════════════════════════════════════════════════════════════════════════
-- BioInnova · La venta vinculada a su cotización, con el costo congelado
-- Proyecto Supabase: mnuldrgynighabwtulkf
-- Pegar TODO en Supabase → SQL Editor → New query → Run
--
-- QUÉ GUARDA CADA COLUMNA
--   cotiz_id / cotiz_num  la cotización de la que salió la factura
--   items                 el detalle real: las líneas de esa cotización, cada
--                         una con su costo de producción, flete y comisión
--   costo                 el costo total CONGELADO en el momento de facturar.
--                         No se recalcula nunca: si mañana cambia el precio de
--                         un insumo, el margen de esta venta no se mueve.
--   sin_costeo            true si algún ítem no tiene fórmula y por lo tanto
--                         su costo no se pudo calcular (margen incompleto).
--
-- Mientras esto no corra, la venta se guarda igual pero SIN el vínculo ni el
-- costo: el sync reintenta sin estas columnas (toRowSafe).
--
-- No toca políticas ni datos. Es seguro correrlo más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bio_ventas add column if not exists cotiz_id   text;
alter table public.bio_ventas add column if not exists cotiz_num  integer;
alter table public.bio_ventas add column if not exists items      jsonb;
alter table public.bio_ventas add column if not exists costo      numeric;
alter table public.bio_ventas add column if not exists sin_costeo boolean default false;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — se esperan las 5 filas.
-- ═══════════════════════════════════════════════════════════════════════════
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'bio_ventas'
  and column_name in ('cotiz_id','cotiz_num','items','costo','sin_costeo')
order by column_name;
