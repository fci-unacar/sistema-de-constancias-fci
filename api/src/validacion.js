/** Validaciones compartidas por las rutas de datos. */

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * true si es una fecha "AAAA-MM-DD" que existe en el calendario. El
 * formato solo no basta: "2026-13-45" lo cumple y Postgres la rechaza.
 */
export function esFechaValida(valor) {
  if (typeof valor !== 'string' || !FECHA_RE.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}
