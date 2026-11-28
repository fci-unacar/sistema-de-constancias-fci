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

// Igual que frontend/src/constants/tipos.js y los checks de las tablas.
export const TIPOS = new Set(['normal', 'promedio', 'buena-conducta', 'terminacion']);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tipo real de un archivo según sus primeros bytes (PDF, JPG o PNG), o
 * null si no es ninguno. No se confía en el Content-Type ni en la
 * extensión: cualquiera los puede cambiar.
 */
export function tipoDeArchivo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return null;
  if (buffer.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  return null;
}
