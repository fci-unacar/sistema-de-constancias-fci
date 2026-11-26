/**
 * Catálogo de programas educativos (Regla P1). Con login real el catálogo
 * vive en la base de datos (tabla programas) y esta lista solo se usa
 * mientras carga o en modo de demostración (ver hooks/useProgramas.js). No
 * hay pantalla para editarlo: se cambia desde Supabase.
 */
export const PROGRAMAS_INICIALES = [
  'Ingeniería en Sistemas Computacionales',
  'Ingeniería en Diseño Multimedia',
  'Ingeniería en Tecnologías de Cómputo y Comunicación',
];
