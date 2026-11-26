import { useEffect, useState } from 'react';
import { PROGRAMAS_INICIALES } from '../data/programas';
import { apiFetch } from '../lib/api';
import { USA_BASE_DE_DATOS } from '../lib/modo';

/**
 * Catálogo de programas educativos (Regla P1).
 *
 * Con login real se lee de la base de datos (tabla programas); mientras
 * carga, o si la API falla, se usa la lista de data/programas.js para que
 * el formulario siga funcionando. En modo de demostración es solo esa
 * lista. El sistema aún no tiene pantalla para editar el catálogo: se
 * cambia desde el SQL Editor de Supabase.
 *
 * Renombrar un programa no cambia el texto de constancias ya generadas
 * (el historial guarda el nombre tal como estaba al generarse).
 */
export function useProgramas() {
  const [programas, setProgramas] = useState(PROGRAMAS_INICIALES);

  useEffect(() => {
    if (!USA_BASE_DE_DATOS) return undefined;
    let cancelado = false;
    apiFetch('/programas')
      .then(({ programas: deLaBase }) => {
        if (!cancelado && deLaBase.length > 0) setProgramas(deLaBase);
      })
      .catch((error) => console.warn('No se pudo leer el catálogo de programas:', error.message));
    return () => {
      cancelado = true;
    };
  }, []);

  return { programas };
}
