import { useEffect, useState } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';
import { seedHistorial } from '../data/seedHistorial';

const STORAGE_KEY = 'constancias-fci-historial-v1';

const FOLIO_INICIAL = 101;
const FOLIO_RE = /^FCI-\d{4}-(\d+)$/;

/**
 * Folio consecutivo (Regla F1): "FCI-<año actual>-<n>", compartido entre
 * tipos. El número sigue al más alto ya emitido y no se reinicia al cambiar
 * de año (FCI-2026-348 → FCI-2027-349), igual que la secuencia propuesta en
 * supabase/migrations. Se toma el máximo y no el tamaño del historial para
 * que importar respaldos no lo haga repetir ni brincar; las constancias de
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
 * Estado del historial de constancias generadas, respaldado en
 * localStorage (ver utils/storage.js). Expone el folio siguiente y
 * funciones para registrar, anular/reactivar, contar descargas, e
 * importar/reemplazar el historial completo (respaldo), para que los
 * componentes de UI no toquen el almacenamiento directamente.
 */
export function useHistorial() {
  const [historial, setHistorial] = useState(() => {
    const stored = loadJSON(STORAGE_KEY);
    return (stored || seedHistorial()).map(withDefaults);
  });

  useEffect(() => {
    saveJSON(STORAGE_KEY, historial);
  }, [historial]);

  const nextFolio = siguienteFolio(historial);

  function registrarConstancia({ tipo, data }) {
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

  function anularConstancia(id) {
    setHistorial((prev) => prev.map((e) => (e.id === id ? { ...e, estado: 'anulada' } : e)));
  }

  function reactivarConstancia(id) {
    setHistorial((prev) => prev.map((e) => (e.id === id ? { ...e, estado: 'vigente' } : e)));
  }

  function registrarDescarga(id) {
    setHistorial((prev) => prev.map((e) => (e.id === id ? { ...e, descargas: (e.descargas || 0) + 1 } : e)));
  }

  /**
   * Importa un respaldo (ver utils/historialBackup.js): agrega las
   * entradas cuyo folio no exista ya, sin tocar las existentes.
   */
  function importarHistorial(entradas) {
    let agregadas = 0;
    setHistorial((prev) => {
      const foliosExistentes = new Set(prev.map((e) => e.folio));
      const nuevas = entradas.map(withDefaults).filter((e) => !foliosExistentes.has(e.folio));
      agregadas = nuevas.length;
      return [...nuevas, ...prev];
    });
    return agregadas;
  }

  // Orden por fecha de generación (más reciente primero) — así un respaldo
  // importado con constancias más viejas no desordena "más recientes" en
  // el historial ni en el panel de Inicio.
  const historialOrdenado = [...historial].sort(
    (a, b) => (b.fechaGeneracion || '').localeCompare(a.fechaGeneracion || '') || b.id.localeCompare(a.id),
  );

  return {
    historial: historialOrdenado,
    nextFolio,
    registrarConstancia,
    anularConstancia,
    reactivarConstancia,
    registrarDescarga,
    importarHistorial,
  };
}
