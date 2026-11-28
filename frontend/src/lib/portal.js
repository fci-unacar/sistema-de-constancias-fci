/**
 * La misma aplicación sirve dos portales:
 * - /alumnos: el portal de alumnos (solicitar constancias y ver su estado).
 * - todo lo demás: el panel de la Secretaría Académica.
 *
 * Se decide una vez al cargar la página, por la ruta. vercel.json manda
 * cualquier ruta a index.html, así que /alumnos funciona sin configurar nada.
 */
export const RUTA_ALUMNOS = '/alumnos';

export const ES_PORTAL_ALUMNOS =
  typeof window !== 'undefined' && /^\/alumnos(\/|$)/.test(window.location.pathname);
