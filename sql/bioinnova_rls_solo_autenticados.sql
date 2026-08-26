-- ═══════════════════════════════════════════════════════════════════════════
-- BioInnova · Cerrar la base a los usuarios con sesión iniciada
-- Proyecto Supabase: mnuldrgynighabwtulkf
-- Pegar TODO en Supabase → SQL Editor → New query → Run
--
-- QUÉ HACE
--   1. Borra TODAS las políticas existentes de las tablas de public
--      (incluidas las que dejaban entrar al visitante anónimo).
--   2. Activa Row-Level Security en todas ellas.
--   3. Crea una política única por tabla: acceso total, pero SOLO para
--      usuarios con sesión iniciada (rol "authenticated").
--
--   Resultado: quien tenga la URL y la clave pública del proyecto y no haya
--   iniciado sesión, no lee ni escribe nada.
--
-- ⚠ REQUISITO PREVIO
--   BioInnova ya manda el token del usuario en cada consulta (authToken), asi
--   que no requiere cambios en el codigo. Lo unico que cambia: si vence la
--   sesion y no se puede renovar, la app deja de ver datos y hay que reingresar.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare t record; p record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop

    -- 1. fuera las políticas viejas (las permisivas al anónimo incluidas)
    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = t.tablename loop
      execute format('drop policy %I on public.%I', p.policyname, t.tablename);
    end loop;

    -- 2. candado puesto
    execute format('alter table public.%I enable row level security', t.tablename);

    -- 3. una sola puerta: hay que estar logueado
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t.tablename || '_auth', t.tablename);

  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr esto después y revisar el resultado.
-- Se espera: rls_activo = true en todas, y en "quien_entra" solo {authenticated}.
-- Si en alguna fila aparece "anon", esa tabla quedó abierta.
-- ═══════════════════════════════════════════════════════════════════════════
select
  t.tablename                                    as tabla,
  t.rowsecurity                                  as rls_activo,
  coalesce(string_agg(p.policyname, ', '), '— sin política —') as politicas,
  coalesce(string_agg(array_to_string(p.roles, '+'), ', '), '—') as quien_entra
from pg_tables t
left join pg_policies p
       on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename, t.rowsecurity
order by t.tablename;
