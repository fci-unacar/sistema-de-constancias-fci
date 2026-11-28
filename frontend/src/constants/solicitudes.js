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

/**
 * Texto para Secretaría según cómo le fue al aviso por correo al alumno
 * (ver api/src/correo.js). Vacío si el correo no está configurado.
 */
export function textoAvisoCorreo(notificacion) {
  if (notificacion === 'enviada') return ' Se le avisó al alumno por correo.';
  if (notificacion === 'fallo') return ' No se pudo avisar al alumno por correo; lo verá en su portal.';
  return '';
}

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

/** Días hábiles sin atender a partir de los cuales una solicitud está atrasada (en rojo). */
export const DIAS_ATRASO = 2;

/**
 * Días hábiles (lunes a viernes) que han pasado desde la fecha: cuenta
 * cada día laborable después del día en que llegó, hasta hoy. Una que
 * llegó el viernes, el lunes lleva 1. No descuenta días festivos.
 */
export function diasHabilesDesde(iso, ahora = new Date()) {
  const dia = new Date(iso);
  dia.setHours(0, 0, 0, 0);
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  let dias = 0;
  while (dia < hoy) {
    dia.setDate(dia.getDate() + 1);
    const semana = dia.getDay();
    if (semana !== 0 && semana !== 6) dias += 1;
  }
  return dias;
}

export const NIVEL_ATRASO = { A_TIEMPO: 'a-tiempo', POR_VENCER: 'por-vencer', ATRASADA: 'atrasada' };

/** Semáforo de una solicitud pendiente: amarillo desde 1 día hábil, rojo desde DIAS_ATRASO. */
export function nivelAtraso(solicitud, ahora = new Date()) {
  if (solicitud.estado !== ESTADO_SOLICITUD.PENDIENTE) return null;
  const dias = diasHabilesDesde(solicitud.creadoEn, ahora);
  if (dias >= DIAS_ATRASO) return NIVEL_ATRASO.ATRASADA;
  if (dias >= 1) return NIVEL_ATRASO.POR_VENCER;
  return NIVEL_ATRASO.A_TIEMPO;
}

export const NIVEL_ATRASO_CLASS = {
  [NIVEL_ATRASO.A_TIEMPO]: 'bg-secondary-fixed text-on-secondary-fixed',
  [NIVEL_ATRASO.POR_VENCER]: 'bg-warning-container text-warning',
  [NIVEL_ATRASO.ATRASADA]: 'bg-error text-on-error',
};

/** "hace 5 min", "hace 3 h", "hace 2 días". */
export function haceCuanto(iso, ahora = new Date()) {
  const minutos = Math.max(0, Math.floor((ahora - new Date(iso)) / 60000));
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}
