/**
 * Quiénes firman las constancias, tal como estaban en las plantillas
 * oficiales. Se editan desde "Configuración de Plantillas" (ver
 * hooks/usePlantillas.js) cuando cambia la Secretaria Administrativa o el
 * Director.
 *
 * Cada constancia guarda una copia de los firmantes con que se emitió
 * (data.firmantes); si se reimprime después de un cambio, sale con la firma
 * original. Las constancias emitidas antes de que existiera esa copia se
 * muestran con estos valores, que eran los vigentes entonces.
 */
export const FIRMANTES_INICIALES = {
  // Firma reinscripción, promedio y terminación de estudios.
  secretaria: {
    nombre: 'Mtra. Saide Dariola Duran Martin',
    cargo: 'Secretaria Administrativa de la Facultad de Ciencias de la Información',
    email: 'sduran@delfin.unacar.mx',
  },
  // Firma la carta de buena conducta, y su nombre y cargo abren el texto
  // ("El que suscribe …").
  director: {
    articulo: 'El',
    nombre: 'Dr. José Alonso Pérez Cruz',
    cargo: 'Director de la Facultad de Ciencias de la Información',
    email: '',
  },
  // Iniciales de quien elabora, al pie de la carta de buena conducta (C.c.p.).
  ccpIniciales: 'FCI/sddm.',
};
