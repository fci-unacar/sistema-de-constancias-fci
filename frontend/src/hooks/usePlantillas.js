import { useEffect, useState } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';
import { FIRMANTES_INICIALES } from '../data/firmantesIniciales';
import { apiFetch } from '../lib/api';
import { USA_BASE_DE_DATOS } from '../lib/modo';

const STORAGE_KEY = 'constancias-fci-plantillas-v1';

/**
 * Firmantes en la base de datos, a través de la API: los mismos para todos
 * los equipos. Mientras carga (o si nunca se han guardado) se usan los
 * originales de data/firmantesIniciales.js.
 */
function usePlantillasApi() {
  const [firmantes, setFirmantes] = useState(FIRMANTES_INICIALES);

  useEffect(() => {
    let vigente = true;
    apiFetch('/plantillas')
      .then(({ plantillas }) => vigente && plantillas && setFirmantes(plantillas))
      .catch((error) => console.warn('No se pudo leer la configuración de plantillas:', error.message));
    return () => {
      vigente = false;
    };
  }, []);

  /** @returns {Promise<string|null>} null si se guardó; si no, el mensaje de error */
  async function guardarFirmantes(nuevos) {
    try {
      const { plantillas } = await apiFetch('/plantillas', {
        method: 'PUT',
        body: JSON.stringify({ plantillas: nuevos }),
      });
      setFirmantes(plantillas);
      return null;
    } catch (error) {
      console.error('No se pudo guardar la configuración de plantillas:', error);
      return error.message;
    }
  }

  return { firmantes, guardarFirmantes };
}

/** Firmantes en este navegador (modo de demostración, ver lib/modo.js). */
function usePlantillasLocal() {
  const [firmantes, setFirmantes] = useState(() => loadJSON(STORAGE_KEY) || FIRMANTES_INICIALES);

  useEffect(() => {
    saveJSON(STORAGE_KEY, firmantes);
  }, [firmantes]);

  async function guardarFirmantes(nuevos) {
    setFirmantes({ ...nuevos, actualizado: new Date().toISOString() });
    return null;
  }

  return { firmantes, guardarFirmantes };
}

/**
 * Quiénes firman las constancias (Secretaria Administrativa y Director) y
 * las iniciales del C.c.p., editables desde "Configuración de Plantillas".
 * Con login real viven en la base de datos; en modo de demostración, en el
 * navegador.
 */
export const usePlantillas = USA_BASE_DE_DATOS ? usePlantillasApi : usePlantillasLocal;
