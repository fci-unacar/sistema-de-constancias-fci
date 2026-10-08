import { TIPO_CONSTANCIA } from '../constants/tipos';
import { ordinalWord, formatDateRange, formatDateNumeric, dateWordParts } from './spanishText';

/**
 * Fuente única del texto legal de cada tipo de constancia: tanto la vista
 * previa en HTML (components/document/PreviewDocument.jsx) como el PDF real
 * (src/pdf/ConstanciaPdfDocument.jsx) arman sus párrafos a partir de este
 * módulo, para que el documento descargado nunca pueda quedar desalineado
 * de lo que la Secretaría ya revisó en pantalla.
 *
 * Cada párrafo es una lista de "runs": texto fijo (`{ text }`) o dato
 * variable (`{ value, placeholder }`), en el mismo orden en que deben
 * concatenarse.
 */

function v(value, placeholder) {
  return { value, placeholder };
}

function getNormalContent(data) {
  const periodo = formatDateRange(data.periodoInicio, data.periodoFin);
  const vacaciones = formatDateRange(data.vacacionesInicio, data.vacacionesFin);
  const expedicion = dateWordParts(data.fechaExpedicion);

  return {
    addressLines: ['A QUIEN CORRESPONDA', 'P R E S E N T E.'],
    paragraphs: [
      [
        {
          text: 'La Facultad de Ciencias de la Información de la Universidad Autónoma del Carmen, con número de registro 04USU0018T ante la Secretaria de Educación Pública, hace constar que:',
        },
      ],
      [{ text: 'El alumno (a): ' }, v(data.alumno, '‹nombre del alumno›')],
      [
        { text: 'Con matrícula No.' },
        v(data.matricula, '‹matrícula›'),
        { text: ', ha realizado su ' },
        v(data.reinscripcion ? ordinalWord(Number(data.reinscripcion)) : '', '‹reinscripción›'),
        {
          text: ' reinscripción semestral como alumno ordinario regular del Programa Educativo de Licenciatura en ',
        },
        v(data.programa, '‹programa educativo›'),
        { text: '. Cabe mencionar que dicha reinscripción comprende el periodo del ' },
        v(periodo, '‹periodo del semestre›'),
        { text: ', que considera el periodo vacacional ' },
        v(vacaciones, '‹periodo vacacional›'),
        { text: '.' },
      ],
      [
        {
          text: 'A petición de la parte interesada y para los efectos legales correspondientes, se expide la presente constancia en la Ciudad y Puerto del Carmen, Estado de Campeche, a los ',
        },
        v(expedicion?.dia, '‹día›'),
        { text: ' días del mes de ' },
        v(expedicion?.mes, '‹mes›'),
        { text: ' del dos mil ' },
        v(expedicion?.anioSuf, '‹año›'),
        { text: '.' },
      ],
    ],
  };
}

function getPromedioContent(data) {
  const periodo = formatDateRange(data.periodoInicio, data.periodoFin);
  const consulta = formatDateNumeric(data.fechaConsulta);
  const expedicion = dateWordParts(data.fechaExpedicion);

  return {
    addressLines: ['A QUIEN CORRESPONDA', 'P R E S E N T E'],
    paragraphs: [
      [
        {
          text: 'La Facultad de Ciencias de la Información de la Universidad Autónoma del Carmen, con número de registro 04USU0018T ante la Secretaria de Educación Pública, hace constar que:',
        },
      ],
      [{ text: 'El alumno (a): ' }, v(data.alumno, '‹nombre del alumno›')],
      [
        { text: 'Con matrícula No.' },
        v(data.matricula, '‹matrícula›'),
        {
          text: ', de acuerdo con la consulta realizada de su historial académico en el sistema SUCEWEB con fecha ',
        },
        v(consulta, '‹fecha de consulta›'),
        { text: ', el estudiante realizó su ' },
        v(data.reinscripcion ? ordinalWord(Number(data.reinscripcion)) : '', '‹reinscripción›'),
        { text: ' reinscripción semestral como alumno ordinario regular del Programa Educativo de ' },
        v(data.programa, '‹programa educativo›'),
        { text: ', obteniendo en el semestre ' },
        v(data.semestreCursado, '‹semestre›'),
        { text: ' un promedio de ' },
        v(data.promedioSemestre, '‹XX›'),
        { text: ' y actualmente cuenta con un promedio general de ' },
        v(data.promedioGeneral, '‹XX›'),
        { text: '.' },
      ],
      [
        { text: 'Cabe mencionar que su reinscripción comprende el periodo del ' },
        v(periodo, '‹periodo de reinscripción›'),
        { text: '.' },
      ],
      [
        {
          text: 'A petición de la parte interesada y para los efectos legales correspondientes, se expide la presente constancia en la Ciudad y Puerto del Carmen, Estado de Campeche, a los ',
        },
        v(expedicion?.dia, '‹día›'),
        { text: ' días del mes de ' },
        v(expedicion?.mes, '‹mes›'),
        { text: ' del dos mil ' },
        v(expedicion?.anioSuf, '‹año›'),
        { text: '.' },
      ],
    ],
  };
}

/** Carta de buena conducta — la firma el Director, no la Secretaria Administrativa. */
function getBuenaConductaContent(data) {
  const expedicion = dateWordParts(data.fechaExpedicion);

  return {
    addressLines: ['A quien corresponda:'],
    paragraphs: [
      [
        {
          text: 'El que suscribe Dr. José Alonso Pérez Cruz, Director de la Facultad de Ciencias de la Información, de la Universidad Autónoma del Carmen, hace constar que el C. ',
        },
        v(data.alumno, '‹nombre del alumno›'),
        { text: ' con matrícula número ' },
        v(data.matricula, '‹matrícula›'),
        { text: ' de la Licenciatura en ' },
        v(data.programa, '‹programa educativo›'),
        { text: ' desde el periodo escolar ' },
        v(data.periodoIngreso, '‹periodo de ingreso›'),
        {
          text: ' que ha estado como alumno de esta institución, se le ha observado Buena Conducta.',
        },
      ],
      [
        {
          text: 'A petición de la parte interesada y para los fines legales correspondientes, se extiende la presente constancia en la Ciudad y Puerto del Carmen, Estado de Campeche, a los ',
        },
        v(expedicion?.dia, '‹día›'),
        { text: ' días del mes de ' },
        v(expedicion?.mes, '‹mes›'),
        { text: ' del año dos mil ' },
        v(expedicion?.anioSuf, '‹año›'),
        { text: '.' },
      ],
      [{ text: 'Sin más por el momento le envío un cordial saludo.' }],
    ],
    cierre: 'Atentamente,',
    firma: {
      nombre: 'Dr. José Alonso Pérez Cruz',
      cargo: 'Director de la Facultad de Ciencias de la Información',
    },
    ccp: ['C.c.p. Archivo', 'FCI/sddm.'],
  };
}

/** Constancia de terminación de estudios (100% de créditos, certificado pendiente). */
function getTerminacionContent(data) {
  const expedicion = dateWordParts(data.fechaExpedicion);

  return {
    addressLines: ['A QUIEN CORRESPONDA', 'P R E S E N T E.'],
    paragraphs: [
      [
        {
          text: 'La Facultad de Ciencias de la Información de la Universidad Autónoma del Carmen, con número de registro 04USU0018T ante la Secretaria de Educación Pública, hace constar que:',
        },
      ],
      [{ text: 'El alumno (a): ' }, v(data.alumno, '‹nombre del alumno›')],
      [
        { text: 'Con matrícula N° ' },
        v(data.matricula, '‹matrícula›'),
        { text: ', tiene cubierto el ' },
        { text: '100%', bold: true },
        { text: ' de los cursos del Programa Educativo de ' },
        { text: 'Licenciatura en ', bold: true },
        { ...v(data.programa, '‹programa educativo›'), bold: true },
        {
          text: ', quedando pendiente de tramitar su certificado de estudios, siendo este requisito indispensable para promover su egreso de dicho Programa Educativo.',
        },
      ],
      [
        {
          text: 'A petición de la parte interesada y para los efectos legales correspondientes, se expide la presente Constancia en la Ciudad y Puerto del Carmen, Estado de Campeche, a los ',
        },
        v(expedicion?.dia, '‹día›'),
        { text: ' días del mes de ' },
        v(expedicion?.mes, '‹mes›'),
        { text: ' del dos mil ' },
        v(expedicion?.anioSuf, '‹año›'),
        { text: '.' },
      ],
    ],
    firma: { nombre: 'Mtra. Saide D. Duran Martín' },
  };
}

/** Cierre y firma de las constancias que no declaran los suyos (reinscripción y promedio). */
const CIERRE_DEFAULT = 'A t e n t a m e n t e';
const FIRMA_DEFAULT = {
  nombre: 'Mtra. Saide Dariola Duran Martin',
  cargo: 'Secretaria Administrativa de la Facultad de Ciencias de la Información',
  email: 'sduran@delfin.unacar.mx',
};

function getContentByTipo(tipo, data) {
  if (tipo === TIPO_CONSTANCIA.PROMEDIO) return getPromedioContent(data);
  if (tipo === TIPO_CONSTANCIA.BUENA_CONDUCTA) return getBuenaConductaContent(data);
  if (tipo === TIPO_CONSTANCIA.TERMINACION) return getTerminacionContent(data);
  return getNormalContent(data);
}

/**
 * Arma el contenido del tipo de constancia dado: encabezado de dirección,
 * párrafos, fórmula de cierre, firma y copias (`ccp`, opcional).
 */
export function getConstanciaContent(tipo, data) {
  const content = getContentByTipo(tipo, data);
  return { cierre: CIERRE_DEFAULT, firma: FIRMA_DEFAULT, ccp: [], ...content };
}
