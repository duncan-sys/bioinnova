-- BioInnova · Compromisos fijos: proveedor que factura
-- Ejecutar en Supabase → SQL Editor (proyecto mnuldrgynighabwtulkf)
-- Sirve para que la cuota fija (ej. el alquiler de LDC) NO se duplique con la factura real
-- de ese proveedor: en los meses donde ya hay factura cargada, la cuota se netea contra ella.

alter table public.bio_prestamos add column if not exists proveedor text;
