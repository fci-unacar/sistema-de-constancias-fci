-- =====================================================================
-- "Tomar" una solicitud de alumno, para que dos personas de Secretaría no
-- atiendan la misma (y no se gasten dos folios en una sola solicitud).
--
-- Quien da "Generar" toma la solicitud: queda a su nombre y las demás la
-- ven ocupada. Si se va sin terminar, la toma vence sola a la hora
-- (TOMA_VIGENCIA) y otra persona puede tomarla.
--
-- Las dos operaciones son un solo UPDATE condicionado, así que si dos
-- personas dan clic al mismo tiempo, solo una gana:
-- - tomar_solicitud: la aparta si está pendiente y libre (o ya era suya,
--   o la toma anterior venció).
-- - cerrar_solicitud: la marca lista o rechazada solo si sigue pendiente
--   y nadie más la tiene tomada.
-- =====================================================================

alter table public.solicitudes
  add column if not exists tomada_por text,
  add column if not exists tomada_en  timestamptz;

create or replace function public.tomar_solicitud(p_id uuid, p_email text)
returns setof public.solicitudes
language sql
as $$
  update public.solicitudes
     set tomada_por = p_email, tomada_en = now(), actualizado_en = now()
   where id = p_id
     and estado = 'pendiente'
     and (tomada_por is null or tomada_por = p_email or tomada_en < now() - interval '1 hour')
  returning *;
$$;

create or replace function public.soltar_solicitud(p_id uuid, p_email text)
returns setof public.solicitudes
language sql
as $$
  update public.solicitudes
     set tomada_por = null, tomada_en = null, actualizado_en = now()
   where id = p_id and tomada_por = p_email
  returning *;
$$;

create or replace function public.cerrar_solicitud(
  p_id uuid,
  p_email text,
  p_estado text,
  p_motivo text,
  p_constancia_id uuid
)
returns setof public.solicitudes
language sql
as $$
  update public.solicitudes
     set estado         = p_estado,
         motivo_rechazo = case when p_estado = 'rechazada' then p_motivo end,
         constancia_id  = case when p_estado = 'lista' then p_constancia_id end,
         atendida_por   = p_email,
         tomada_por     = null,
         tomada_en      = null,
         actualizado_en = now()
   where id = p_id
     and estado = 'pendiente'
     and p_estado in ('lista', 'rechazada')
     and (tomada_por is null or tomada_por = p_email or tomada_en < now() - interval '1 hour')
  returning *;
$$;

grant execute on function public.tomar_solicitud(uuid, text) to service_role;
grant execute on function public.soltar_solicitud(uuid, text) to service_role;
grant execute on function public.cerrar_solicitud(uuid, text, text, text, uuid) to service_role;

-- Solo la API (service_role) las llama.
revoke execute on function public.tomar_solicitud(uuid, text) from public, anon, authenticated;
revoke execute on function public.soltar_solicitud(uuid, text) from public, anon, authenticated;
revoke execute on function public.cerrar_solicitud(uuid, text, text, text, uuid) from public, anon, authenticated;
