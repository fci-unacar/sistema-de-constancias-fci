-- =====================================================================
-- Permisos para la API (rol service_role).
--
-- Los proyectos nuevos de Supabase ya no otorgan privilegios automáticos
-- sobre las tablas que se crean desde SQL: sin esto, la API recibe
-- "permission denied for table ..." (403) aunque use la llave secreta.
--
-- Solo se otorgan a service_role. anon y authenticated se quedan sin
-- privilegios, así que la base sigue cerrada al navegador (además de RLS).
-- =====================================================================

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public to service_role;

grant usage, select
  on all sequences in schema public to service_role;

grant execute
  on all functions in schema public to service_role;

-- Lo mismo para lo que se cree después en el esquema public.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
