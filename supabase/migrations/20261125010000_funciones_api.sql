-- =====================================================================
-- Funciones que usa la API para el historial de constancias.
--
-- Cada operación que debe ser atómica vive aquí y no en la API: así dos
-- equipos generando al mismo tiempo no pueden repetir folio ni perder una
-- descarga, porque Postgres resuelve la concurrencia.
--
-- Solo service_role (la API) puede ejecutarlas. Postgres da EXECUTE a
-- PUBLIC por defecto en toda función nueva; se le quita explícitamente,
-- también a siguiente_folio(), que ya existía.
-- =====================================================================

-- Folio que tocaría ahora, sin consumirlo (para mostrarlo en el formulario
-- antes de generar). Es solo una vista previa: el folio definitivo lo
-- asigna registrar_constancia() y puede ser otro si alguien generó antes.
create or replace function public.folio_siguiente_vista()
returns text
language sql
stable
as $$
  select 'FCI-' || to_char(now() at time zone 'America/Mexico_City', 'YYYY')
      || '-' || (case when is_called then last_value + 1 else last_value end)::text
  from public.folio_consecutivo;
$$;

-- Registra una constancia nueva con el siguiente folio de la secuencia.
create or replace function public.registrar_constancia(p_tipo text, p_data jsonb)
returns setof public.constancias
language sql
volatile
as $$
  insert into public.constancias (folio, tipo, data, fecha_generacion)
  values (
    public.siguiente_folio(),
    p_tipo,
    p_data,
    (now() at time zone 'America/Mexico_City')::date
  )
  returning *;
$$;

-- Suma una descarga sin leer-y-escribir desde la API (evita perder
-- descargas si dos personas reimprimen a la vez).
create or replace function public.incrementar_descarga(p_id uuid)
returns setof public.constancias
language sql
volatile
as $$
  update public.constancias
     set descargas = descargas + 1,
         actualizado_en = now()
   where id = p_id
  returning *;
$$;

-- Importa un respaldo del historial que se guardaba en el navegador
-- ("Exportar respaldo" en la versión anterior). Agrega solo los folios
-- que no existan y adelanta la secuencia para que el siguiente folio no
-- choque con los importados. Devuelve cuántas se agregaron.
create or replace function public.importar_constancias(p_entradas jsonb)
returns integer
language plpgsql
volatile
as $$
declare
  agregadas integer;
  mayor     bigint;
begin
  with nuevas as (
    insert into public.constancias (folio, tipo, estado, es_ejemplo, descargas, fecha_generacion, data)
    select e->>'folio',
           e->>'tipo',
           coalesce(e->>'estado', 'vigente'),
           false,
           greatest(coalesce((e->>'descargas')::integer, 1), 0),
           coalesce((e->>'fechaGeneracion')::date, current_date),
           e->'data'
      from jsonb_array_elements(p_entradas) as e
     where coalesce((e->>'isExample')::boolean, false) = false
       and e->>'folio' ~ '^FCI-\d{4}-\d+$'
       and e->>'tipo' in ('normal', 'promedio', 'buena-conducta', 'terminacion')
       and jsonb_typeof(e->'data') = 'object'
    on conflict (folio) do nothing
    returning 1
  )
  select count(*) into agregadas from nuevas;

  select max(substring(folio from '^FCI-\d{4}-(\d+)$')::bigint)
    into mayor
    from public.constancias;

  if mayor is not null then
    perform setval(
      'public.folio_consecutivo',
      greatest(
        mayor,
        (select case when is_called then last_value else last_value - 1 end from public.folio_consecutivo)
      ),
      true
    );
  end if;

  return agregadas;
end;
$$;

revoke execute on function public.siguiente_folio()                  from public, anon, authenticated;
revoke execute on function public.folio_siguiente_vista()            from public, anon, authenticated;
revoke execute on function public.registrar_constancia(text, jsonb)  from public, anon, authenticated;
revoke execute on function public.incrementar_descarga(uuid)         from public, anon, authenticated;
revoke execute on function public.importar_constancias(jsonb)        from public, anon, authenticated;

grant execute on function public.siguiente_folio()                  to service_role;
grant execute on function public.folio_siguiente_vista()            to service_role;
grant execute on function public.registrar_constancia(text, jsonb)  to service_role;
grant execute on function public.incrementar_descarga(uuid)         to service_role;
grant execute on function public.importar_constancias(jsonb)        to service_role;

-- importar_constancias() adelanta la secuencia con setval(), que pide UPDATE.
grant update on sequence public.folio_consecutivo to service_role;
