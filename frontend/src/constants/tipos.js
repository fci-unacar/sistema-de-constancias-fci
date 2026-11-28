/** Tipos de constancia soportados y las vistas del panel principal. */
export const TIPO_CONSTANCIA = {
  NORMAL: 'normal',
  PROMEDIO: 'promedio',
  BUENA_CONDUCTA: 'buena-conducta',
  TERMINACION: 'terminacion',
};

export const VISTA = {
  INICIO: 'inicio',
  HISTORIAL: 'historial',
  NUEVA_NORMAL: 'nueva-normal',
  NUEVA_PROMEDIO: 'nueva-promedio',
  NUEVA_BUENA_CONDUCTA: 'nueva-buena-conducta',
  NUEVA_TERMINACION: 'nueva-terminacion',
  CALENDARIO: 'calendario',
  PLANTILLAS: 'plantillas',
  SOLICITUDES: 'solicitudes',
};

/** Tipo de constancia correspondiente a cada vista "Nueva", si aplica. */
export const TIPO_POR_VISTA = {
  [VISTA.NUEVA_NORMAL]: TIPO_CONSTANCIA.NORMAL,
  [VISTA.NUEVA_PROMEDIO]: TIPO_CONSTANCIA.PROMEDIO,
  [VISTA.NUEVA_BUENA_CONDUCTA]: TIPO_CONSTANCIA.BUENA_CONDUCTA,
  [VISTA.NUEVA_TERMINACION]: TIPO_CONSTANCIA.TERMINACION,
};

/** Vista "Nueva" de cada tipo de constancia (lo inverso de TIPO_POR_VISTA). */
export const VISTA_POR_TIPO = Object.fromEntries(
  Object.entries(TIPO_POR_VISTA).map(([vista, tipo]) => [tipo, vista]),
);

/** Nombre completo de cada tipo, para quien no conoce los nombres cortos (portal de alumnos). */
export const TIPO_NOMBRE_COMPLETO = {
  [TIPO_CONSTANCIA.NORMAL]: 'Constancia de estudios (reinscripción)',
  [TIPO_CONSTANCIA.PROMEDIO]: 'Constancia de promedio',
  [TIPO_CONSTANCIA.BUENA_CONDUCTA]: 'Carta de buena conducta',
  [TIPO_CONSTANCIA.TERMINACION]: 'Constancia de terminación de estudios',
};

export const TIPO_LABEL = {
  [TIPO_CONSTANCIA.NORMAL]: 'Normal',
  [TIPO_CONSTANCIA.PROMEDIO]: 'Promedio',
  [TIPO_CONSTANCIA.BUENA_CONDUCTA]: 'Buena conducta',
  [TIPO_CONSTANCIA.TERMINACION]: 'Terminación',
};

/** Colores del distintivo de cada tipo (historial y vista previa). */
export const TIPO_BADGE_CLASS = {
  [TIPO_CONSTANCIA.NORMAL]: 'bg-primary-fixed text-on-primary-fixed',
  [TIPO_CONSTANCIA.PROMEDIO]: 'bg-secondary-fixed text-on-secondary-fixed',
  [TIPO_CONSTANCIA.BUENA_CONDUCTA]: 'bg-tertiary-fixed-dim text-on-tertiary-fixed',
  [TIPO_CONSTANCIA.TERMINACION]: 'bg-secondary-fixed-dim text-on-secondary-fixed-variant',
};
