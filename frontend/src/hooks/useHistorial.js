import { useCallback, useEffect, useState } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';
import { seedHistorial } from '../data/seedHistorial';
import { apiFetch } from '../lib/api';
import { USA_BASE_DE_DATOS } from '../lib/modo';

const STORAGE_KEY = 'constancias-fci-historial-v1';

const FOLIO_INICIAL = 101;
const FOLIO_RE = /^FCI-\d{4}-(\d+)$/;

/**
 * Folio consecutivo (Regla F1): "FCI-<año actual>-<n>", compartido entre
 * tipos. El número sigue al más alto ya emitido y no se reinicia al cambiar
 * de año (FCI-2026-348 → FCI-2027-349), igual que la secuencia de la base
 * de datos. Se toma el máximo y no el tamaño del historial para que
 * importar respaldos no lo haga repetir ni brincar; las constancias de
 * ejemplo no cuentan.
 */
export function siguienteFolio(historial, anio = new Date().getFullYear()) {
  const ultimo = historial
    .filter((e) => !e.isExample)
    .map((e) => Number(FOLIO_RE.exec(e.folio)?.[1]))
    .filter(Number.isFinite)
    .reduce((max, n) => Math.max(max, n), FOLIO_INICIAL - 1);
  return `FCI-${anio}-${ultimo + 1}`;
}

/** Entradas antiguas (antes de anulación/reimpresión) no traen estos campos. */
function withDefaults(entry) {
  return { estado: 'vigente', descargas: 1, ...entry };
}

/**
 * Orden por fecha de generación (más reciente primero) — así un respaldo
 * importado con constancias más viejas no desordena "más recientes" en el
 * historial ni en el panel de Inicio.
 */
function ordenar(historial) {
  return [...historial].sort(
    (a, b) =>
      (b.fechaGeneracion || '').localeCompare(a.fechaGeneracion || '') ||
      String(b.id).localeCompare(String(a.id)),
  );
}

/**
 * Historial en la base de datos, a través de la API. Es el modo real: el
 * historial es el mismo en todos los equipos y el folio lo asigna la base
 * (no se puede repetir aunque dos personas generen al mismo tiempo).
 *
 * Todas las operaciones son async y lanzan ApiError si la API falla; quien
 * las llama decide cómo avisarlo (ver App.jsx).
 */
function useHistorialApi() {
  const [historial, setHistorial] = useState([]);
  const [nextFolio, setNextFolio] = useState('…');
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  /** Pide el historial y lo aplica, salvo que el componente ya se haya desmontado. */
  const cargar = useCallback(
    (sigueVigente = () => true) =>
      apiFetch('/constancias')
        .then(({ constancias, siguienteFolio: siguiente }) => {
          if (!sigueVigente()) return;
          setHistorial(constancias);
          setNextFolio(siguiente);
          setErrorCarga(null);
        })
        .catch((error) => sigueVigente() && setErrorCarga(error.message))
        .finally(() => sigueVigente() && setCargando(false)),
    [],
  );

  useEffect(() => {
    let vigente = true;
    cargar(() => vigente);
    return () => {
      vigente = false;
    };
  }, [cargar]);

  async function recargar() {
    setCargando(true);
    setErrorCarga(null);
    await cargar();
  }

  function reemplazar(actualizada) {
    setHistorial((prev) => prev.map((e) => (e.id === actualizada.id ? actualizada : e)));
  }

  async function registrarConstancia({ tipo, data }) {
    const { constancia } = await apiFetch('/constancias', {
      method: 'POST',
      body: JSON.stringify({ tipo, data }),
    });
    setHistorial((prev) => [constancia, ...prev]);
    // La secuencia de la base solo avanza, así que el que sigue es este + 1.
    // Si otro equipo generó mientras tanto, la base asigna el correcto al generar.
    setNextFolio(siguienteFolio([constancia]));
    return constancia;
  }

  async function cambiarEstado(id, estado) {
    const { constancia } = await apiFetch(`/constancias/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
    reemplazar(constancia);
  }

  async function registrarDescarga(id) {
    const { constancia } = await apiFetch(`/constancias/${id}/descargas`, { method: 'POST' });
    reemplazar(constancia);
  }

  async function importarHistorial(entradas) {
    const { agregadas } = await apiFetch('/constancias/importar', {
      method: 'POST',
      body: JSON.stringify({ constancias: entradas }),
    });
    await recargar();
    return agregadas;
  }

  return {
    historial: ordenar(historial),
    nextFolio,
    cargando,
    errorCarga,
    recargar,
    registrarConstancia,
    anularConstancia: (id) => cambiarEstado(id, 'anulada'),
    reactivarConstancia: (id) => cambiarEstado(id, 'vigente'),
    registrarDescarga,
    importarHistorial,
  };
}

/**
 * Historial en localStorage de este navegador. Solo para el modo de
 * demostración (sin login real, ver lib/modo.js): cada equipo tiene el
 * suyo y el folio se calcula aquí. Mismas funciones que useHistorialApi,
 * también async, para que App.jsx no distinga entre los dos.
 */
function useHistorialLocal() {
  const [historial, setHistorial] = useState(() => {
    const stored = loadJSON(STORAGE_KEY);
    return (stored || seedHistorial()).map(withDefaults);
  });

  useEffect(() => {
    saveJSON(STORAGE_KEY, historial);
  }, [historial]);

  const nextFolio = siguienteFolio(historial);

  async function registrarConstancia({ tipo, data }) {
    const entry = {
      id: `c-${Date.now()}`,
      folio: nextFolio,
      tipo,
      isExample: false,
      estado: 'vigente',
      descargas: 1,
      fechaGeneracion: new Date().toISOString().slice(0, 10),
      data,
    };
    setHistorial((prev) => [entry, ...prev]);
    return entry;
  }

  function actualizar(id, cambio) {
    setHistorial((prev) => prev.map((e) => (e.id === id ? { ...e, ...cambio(e) } : e)));
  }

  /**
   * Importa un respaldo (ver utils/historialBackup.js): agrega las
   * entradas cuyo folio no exista ya, sin tocar las existentes.
   */
  async function importarHistorial(entradas) {
    const foliosExistentes = new Set(historial.map((e) => e.folio));
    const nuevas = entradas.map(withDefaults).filter((e) => !foliosExistentes.has(e.folio));
    setHistorial((prev) => [...nuevas, ...prev]);
    return nuevas.length;
  }

  return {
    historial: ordenar(historial),
    nextFolio,
    cargando: false,
    errorCarga: null,
    recargar: async () => {},
    registrarConstancia,
    anularConstancia: async (id) => actualizar(id, () => ({ estado: 'anulada' })),
    reactivarConstancia: async (id) => actualizar(id, () => ({ estado: 'vigente' })),
    registrarDescarga: async (id) => actualizar(id, (e) => ({ descargas: (e.descargas || 0) + 1 })),
    importarHistorial,
  };
}

/**
 * Estado del historial de constancias generadas. Con login real usa la
 * base de datos (vía la API); en modo de demostración, localStorage. El
 * modo se decide una sola vez al cargar la app, así que el orden de los
 * hooks no cambia entre renders.
 */
export const useHistorial = USA_BASE_DE_DATOS ? useHistorialApi : useHistorialLocal;
