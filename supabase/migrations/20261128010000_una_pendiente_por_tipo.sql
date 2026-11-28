-- =====================================================================
-- Un alumno solo puede tener UNA solicitud pendiente de cada tipo de
-- constancia. Puede tener pendientes los cuatro tipos a la vez, pero no
-- dos de la misma; en cuanto Secretaría la marca lista o la rechaza,
-- puede volver a pedir ese tipo. Así no se acumulan solicitudes repetidas.
--
-- La API ya lo revisa antes de guardar (con un mensaje claro para el
-- alumno); este índice es la garantía final si llegan dos envíos al mismo
-- tiempo.
-- =====================================================================

create unique index if not exists solicitudes_una_pendiente_por_tipo
  on public.solicitudes (alumno_email, tipo)
  where estado = 'pendiente';
