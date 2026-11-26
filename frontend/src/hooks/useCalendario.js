import { useEffect, useState } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';
import { loadFile, saveFile } from '../utils/fileStore';
import { CALENDARIO_INICIAL, CAMPOS_SEMESTRE } from '../data/calendarioInicial';
import { apiFetch, apiFetchArchivo } from '../lib/api';
import { USA_BASE_DE_DATOS } from '../lib/modo';

const STORAGE_KEY = 'constancias-fci-calendario-v1';
const PDF_KEY = 'calendario-pdf';

/** URL temporal (blob:) para mostrar un PDF; libera la anterior cuando cambia. */
function usePdfUrl() {
  const [pdfUrl, setPdfUrl] = useState(null);
  useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);
  return [pdfUrl, (blob) => setPdfUrl(blob ? URL.createObjectURL(blob) : null)];
}

/**
 * Calendario en la base de datos, a través de la API: el mismo para todos
 * los equipos. Las fechas viven en la tabla configuracion y el PDF oficial
 * en Storage (privado). Mientras carga se muestran las fechas de
 * data/calendarioInicial.js.
 */
function useCalendarioApi() {
  const [calendario, setCalendario] = useState(CALENDARIO_INICIAL);
  const [pdfUrl, mostrarPdf] = usePdfUrl();

  useEffect(() => {
    let vigente = true;
    apiFetch('/calendario')
      .then(({ calendario: guardado }) => vigente && guardado && setCalendario(guardado))
      .catch((error) => console.warn('No se pudo leer el calendario:', error.message));
    apiFetchArchivo('/calendario/pdf')
      .then((pdf) => vigente && pdf && mostrarPdf(pdf))
      .catch((error) => console.warn('No se pudo leer el PDF del calendario:', error.message));
    return () => {
      vigente = false;
    };
    // mostrarPdf cambia en cada render; solo se carga una vez al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** @returns {Promise<boolean>} si se guardó */
  async function guardarCalendario(nuevo) {
    try {
      const { calendario: guardado } = await apiFetch('/calendario', {
        method: 'PUT',
        body: JSON.stringify({ calendario: nuevo }),
      });
      setCalendario(guardado);
      return true;
    } catch (error) {
      console.error('No se pudo guardar el calendario:', error);
      return false;
    }
  }

  /** @returns {Promise<boolean>} si se guardó */
  async function subirPdf(file) {
    try {
      const { calendario: guardado } = await apiFetch('/calendario/pdf', {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/pdf', 'X-Nombre-Archivo': encodeURIComponent(file.name) },
      });
      setCalendario(guardado);
      mostrarPdf(file);
      return true;
    } catch (error) {
      console.error('No se pudo subir el PDF del calendario:', error);
      return false;
    }
  }

  return { calendario, guardarCalendario, pdfUrl, subirPdf };
}

/**
 * Calendario en este navegador (modo de demostración, ver lib/modo.js):
 * fechas en localStorage y el PDF en IndexedDB (ver utils/fileStore.js).
 * Mismas funciones que useCalendarioApi.
 */
function useCalendarioLocal() {
  const [calendario, setCalendario] = useState(() => loadJSON(STORAGE_KEY) || CALENDARIO_INICIAL);
  const [pdfUrl, mostrarPdf] = usePdfUrl();

  useEffect(() => {
    saveJSON(STORAGE_KEY, calendario);
  }, [calendario]);

  useEffect(() => {
    let vigente = true;
    loadFile(PDF_KEY).then((file) => vigente && file && mostrarPdf(file));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarCalendario(nuevo) {
    setCalendario({ ...nuevo, actualizado: new Date().toISOString() });
    return true;
  }

  async function subirPdf(file) {
    const ok = await saveFile(PDF_KEY, file);
    if (ok) {
      mostrarPdf(file);
      setCalendario((prev) => ({ ...prev, pdfNombre: file.name, pdfSubido: new Date().toISOString() }));
    }
    return ok;
  }

  return { calendario, guardarCalendario, pdfUrl, subirPdf };
}

/**
 * Calendario escolar vigente: las fechas de cada semestre y el PDF oficial
 * del que salen. Las fechas se capturan a mano porque el calendario
 * oficial es una imagen; el PDF se guarda para poder consultarlo desde la
 * app y verificarlas. Con login real vive en la base de datos; en modo de
 * demostración, en el navegador.
 */
export const useCalendario = USA_BASE_DE_DATOS ? useCalendarioApi : useCalendarioLocal;

/** Los periodos de un semestre que usa un formulario, según sus campos obligatorios (la de promedio no lleva vacacional). */
export function periodosDeSemestre(keys, semestre) {
  return Object.fromEntries(CAMPOS_SEMESTRE.filter((c) => keys.includes(c)).map((c) => [c, semestre[c]]));
}

/**
 * El semestre del calendario que corresponde a una fecha ("YYYY-MM-DD"):
 * el que la contiene o, si cae entre semestres, el siguiente en empezar
 * (una constancia de reinscripción se pide para el semestre que viene).
 * Si ya pasaron todos, el último.
 */
export function semestreParaFecha(calendario, fecha) {
  const semestres = [...calendario.semestres]
    .filter((s) => s.periodoInicio && s.periodoFin)
    .sort((a, b) => a.periodoInicio.localeCompare(b.periodoInicio));
  return semestres.find((s) => fecha <= s.periodoFin) ?? semestres[semestres.length - 1] ?? null;
}
