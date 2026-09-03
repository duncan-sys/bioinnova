-- ═══════════════════════════════════════════════════════════════════════════
-- BioInnova · Precios de insumos al 02/09/2026
-- Fuente: "Costo de Insumos 2-09-2026.xlsx", columna SIN IVA.
-- Proyecto Supabase: mnuldrgynighabwtulkf
-- Pegar TODO en Supabase → SQL Editor → New query → Run
--
-- Escribe 40 precios en bio_insprec, la misma tabla que edita la pantalla
-- 🧪 Precios de insumos. Estos valores MANDAN sobre el precio de fábrica y sobre
-- el promedio ponderado de las compras: para que vuelva a mandar el promedio de
-- compras hay que borrar ese insumo desde 🧪.
--
-- No toca políticas. Es seguro correrlo más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.bio_insprec (id, c, gskg, ts) values
  ('IP-INS001', 'INS001', 1000, now()),         -- Maiz
  ('IP-INS002', 'INS002', 1363.64, now()),      -- Burlanda kilos
  ('IP-INS003', 'INS003', 836.36, now()),       -- Afrecho de Arroz
  ('IP-INS007', 'INS007', 1690.91, now()),      -- Sal entrefina yodada animal
  ('IP-INS008', 'INS008', 1963.64, now()),      -- Harina de Soja
  ('IP-INS014', 'INS014', 3818.18, now()),      -- Urea Pecuaria 46%
  ('IP-INS015', 'INS015', 5454.55, now()),      -- Urea protegida producote
  ('IP-INS019', 'INS019', 90.91, now()),        -- Mano de obra - Planta Rio Verde
  ('IP-INS027', 'INS027', 10818.18, now()),     -- Leche Polvo
  ('IP-INS030', 'INS030', 2045.45, now()),      -- Bolsa laminada 57X80 cm - Innova
  ('IP-INS031', 'INS031', 2454.55, now()),      -- Bolsa laminada 60X100 cm - Innova
  ('IP-INS037', 'INS037', 7572.73, now()),      -- Fosfato Dicalcico
  ('IP-INS038', 'INS038', 14181.82, now()),     -- Prymix confipeso
  ('IP-INS039', 'INS039', 19090.91, now()),     -- Prymix confipeso Levadura
  ('IP-INS040', 'INS040', 318.18, now()),       -- Calcareo
  ('IP-INS045', 'INS045', 6000, now()),         -- Azufre pec 99%
  ('IP-INS046', 'INS046', 3381.82, now()),      -- Oxido de Magnesio 52
  ('IP-INS047', 'INS047', 17672.73, now()),     -- Prymix Bio micromin
  ('IP-INS048', 'INS048', 12818.18, now()),     -- Prymix Bio P1G
  ('IP-INS049', 'INS049', 19745.45, now()),     -- Prymix Bio Leche
  ('IP-INS050', 'INS050', 3409.09, now()),      -- Bolsa Confi 4 - 20kg
  ('IP-INS056', 'INS056', 7572.73, now()),      -- Fosfato Dicalcico 18%
  ('IP-INS057', 'INS057', 7572.73, now()),      -- Fosfato Dicalcico - Gilgal
  ('IP-INS058', 'INS058', 1272.73, now()),      -- Cascarilla de Soja
  ('IP-INS059', 'INS059', 330.91, now()),       -- Etiqueta Blanca 10x20
  ('IP-INS060', 'INS060', 330.91, now()),       -- Etiqueta Amarilla 10x20
  ('IP-INS061', 'INS061', 330.91, now()),       -- Etiqueta Celeste 10x20
  ('IP-INS062', 'INS062', 330.91, now()),       -- Etiqueta Roja 10x20
  ('IP-INS063', 'INS063', 330.91, now()),       -- Etiqueta Lila 10x20
  ('IP-INS064', 'INS064', 330.91, now()),       -- Etiqueta Azul Francia 10x20
  ('IP-INS065', 'INS065', 330.91, now()),       -- Etiqueta Verde cl 10x20
  ('IP-INS066', 'INS066', 330.91, now()),       -- Etiqueta Gris 10x20
  ('IP-INS067', 'INS067', 330.91, now()),       -- Etiqueta Marron 10x20
  ('IP-INS068', 'INS068', 330.91, now()),       -- Etiqueta Azul Marino 10x20
  ('IP-INS069', 'INS069', 330.91, now()),       -- Etiqueta Naranja 10x20
  ('IP-INS070', 'INS070', 4200, now()),         -- Zeolita Bolsa 25kg.
  ('IP-INS071', 'INS071', 11018.18, now()),     -- Prymyx Bioinnova Ovinos
  ('IP-INS072', 'INS072', 8618.18, now()),      -- Prymyx Bioinnova SM
  ('IP-INS073', 'INS073', 141818.18, now()),    -- Pawerome RP
  ('IP-INS074', 'INS074', 572727.27, now())     -- Virginamicina
on conflict (id) do update set gskg = excluded.gskg, ts = excluded.ts;


-- VERIFICACION - se esperan al menos 40 filas y ningun precio en cero.
select count(*) as con_precio, min(gskg) as minimo, max(gskg) as maximo
from public.bio_insprec;
