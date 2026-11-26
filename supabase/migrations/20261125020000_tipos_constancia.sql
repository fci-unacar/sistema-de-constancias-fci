-- =====================================================================
-- Tipos de constancia: además de "normal" y "promedio", el sistema emite
-- carta de buena conducta y constancia de terminación de estudios (ver
-- frontend/src/constants/tipos.js). El esquema inicial solo aceptaba los
-- dos primeros.
-- =====================================================================

alter table public.constancias drop constraint if exists constancias_tipo_check;

alter table public.constancias
  add constraint constancias_tipo_check
  check (tipo in ('normal', 'promedio', 'buena-conducta', 'terminacion'));
