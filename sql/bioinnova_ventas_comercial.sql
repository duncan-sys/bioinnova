-- ═══════════════════════════════════════════════════════════════════════════
-- BioInnova · El comercial que hizo la venta
-- Proyecto Supabase: mnuldrgynighabwtulkf
-- Pegar TODO en Supabase → SQL Editor → New query → Run
--
-- Hasta que esto corra, la app guarda la venta igual: el sync detecta el
-- rechazo y reintenta sin la columna (toRowSafe), así que la venta sube pero
-- SIN el comercial. Después de correrlo, cada venta que se toque vuelve a
-- subir completa.
--
-- No toca políticas ni datos. Es seguro correrlo más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bio_ventas add column if not exists comercial text;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — tiene que devolver una fila: comercial | text
-- ═══════════════════════════════════════════════════════════════════════════
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'bio_ventas'
  and column_name  = 'comercial';
