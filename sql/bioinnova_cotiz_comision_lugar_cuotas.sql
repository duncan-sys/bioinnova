-- ═══════════════════════════════════════════════════════════════════════════
-- BioInnova · Los cuatro campos de la cotización que no se estaban guardando
-- Proyecto Supabase: mnuldrgynighabwtulkf
-- Pegar TODO en Supabase → SQL Editor → New query → Run
--
-- POR QUÉ
--   cotizGuardar() arma la cotización con comision_tipo, comision_val, lugar y
--   cuotas, pero cotizRow() nunca los enviaba y la tabla no tiene esas columnas.
--   No hay error: simplemente no viajan. Al abrir la cotización en otro equipo
--   la comisión vuelve al 4% general (cambiando el margen que se ve), el lugar
--   de entrega desaparece del PDF y el plan de pagos no se muestra.
--
-- NO reabre la base al anónimo: acá no se tocan políticas.
-- Es seguro correrlo más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bio_cotiz add column if not exists comision_tipo text;                      -- 'pct' | 'monto'
alter table public.bio_cotiz add column if not exists comision_val  numeric;                   -- % (ej. 4.5) o monto en ₲
alter table public.bio_cotiz add column if not exists lugar         text;                      -- lugar de entrega (sale impreso)
alter table public.bio_cotiz add column if not exists cuotas        jsonb default '[]'::jsonb; -- plan de pagos [{n,venc,monto}]

-- Las cotizaciones ya cargadas quedan con la comisión general, que es lo que se
-- venía asumiendo al abrirlas en otro equipo.
update public.bio_cotiz set comision_tipo = 'pct' where comision_tipo is null;


-- ═══════════════════════════════════════════════════════════════════════════
-- NOTA: el snapshot de costos NO necesita columna. Va dentro de `items`, que ya
-- es jsonb, en items[].desglose. Así la cotización y su costeo viajan juntos.
-- ═══════════════════════════════════════════════════════════════════════════

-- VERIFICACIÓN — correr después. Se esperan las 4 filas.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'bio_cotiz'
  and column_name in ('comision_tipo', 'comision_val', 'lugar', 'cuotas')
order by column_name;
