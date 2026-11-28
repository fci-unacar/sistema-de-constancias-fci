/** Estados de una solicitud de constancia hecha por un alumno (ver api/src/solicitudes.js). */
export const ESTADO_SOLICITUD = {
  PENDIENTE: 'pendiente',
  LISTA: 'lista',
  RECHAZADA: 'rechazada',
};

export const ESTADO_SOLICITUD_LABEL = {
  [ESTADO_SOLICITUD.PENDIENTE]: 'Pendiente',
  [ESTADO_SOLICITUD.LISTA]: 'Lista',
  [ESTADO_SOLICITUD.RECHAZADA]: 'Rechazada',
};

export const ESTADO_SOLICITUD_CLASS = {
  [ESTADO_SOLICITUD.PENDIENTE]: 'bg-warning-container text-warning',
  [ESTADO_SOLICITUD.LISTA]: 'bg-secondary-fixed text-on-secondary-fixed',
  [ESTADO_SOLICITUD.RECHAZADA]: 'bg-error-container text-on-error-container',
};

/** Igual que el límite del bucket "vouchers" en Supabase. */
export const MAX_VOUCHER_BYTES = 5 * 1024 * 1024;

/** Tipos de archivo que se aceptan como voucher, por extensión. */
export const TIPO_VOUCHER_POR_EXTENSION = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** "2026-11-27T15:04:00Z" → "27/11/2026 09:04" en hora local. */
export function fechaHoraCorta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
