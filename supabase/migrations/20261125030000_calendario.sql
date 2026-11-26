-- =====================================================================
-- Calendario escolar compartido.
--
-- Antes vivía en cada navegador (fechas en localStorage y el PDF oficial
-- en IndexedDB), así que si la Secretaría actualizaba las fechas en un
-- equipo, los demás seguían con las viejas.
--
-- - Las fechas van en "configuracion" (clave 'calendario'), un jsonb con la
--   misma forma que frontend/src/data/calendarioInicial.js.
-- - El PDF va en el bucket privado "archivos" de Supabase Storage. Solo la
--   API lo lee y lo escribe (con la llave service_role); el navegador lo
--   pide a la API con su sesión.
-- =====================================================================

create table if not exists public.configuracion (
  clave           text primary key,
  valor           jsonb not null,
  actualizado_en  timestamptz not null default now(),
  -- Correo de quien hizo el último cambio (lo pone la API).
  actualizado_por text
);

-- Igual que el resto: RLS sin políticas, cerrada al navegador.
alter table public.configuracion enable row level security;

grant select, insert, update, delete on public.configuracion to service_role;

-- Bucket privado para el PDF del calendario. Máximo 20 MB y solo PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archivos', 'archivos', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;
