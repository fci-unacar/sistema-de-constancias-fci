import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiFetchArchivo } from '../lib/api';
import { USA_BASE_DE_DATOS } from '../lib/modo';

/** Cada cuánto se vuelve a consultar la bandeja, para ver solicitudes nuevas sin recargar. */
const INTERVALO_MS = 2 * 60 * 1000;

/**
 * Bandeja de solicitudes de los alumnos (ver api/src/solicitudes.js). Solo
 * existe con la base de datos: en modo de demostración no hay portal de
 * alumnos que las mande, así que `disponible` es false y la lista queda vacía.
 */
export function useSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(USA_BASE_DE_DATOS);
  const [errorCarga, setErrorCarga] = useState(null);

  // Todo el setState va en los callbacks de la promesa: así se puede llamar desde el efecto de carga.
  const cargar = useCallback(
    () =>
      apiFetch('/solicitudes')
        .then(({ solicitudes: deLaApi }) => {
          setSolicitudes(deLaApi);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    [],
  );

  const recargar = useCallback(() => {
    if (!USA_BASE_DE_DATOS) return Promise.resolve();
    setCargando(true);
    return cargar();
  }, [cargar]);

  useEffect(() => {
    if (!USA_BASE_DE_DATOS) return undefined;
    cargar();
    const timer = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [cargar]);

  async function cambiarEstado(id, cambios) {
    const { solicitud } = await apiFetch(`/solicitudes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cambios),
    });
    setSolicitudes((prev) => prev.map((s) => (s.id === id ? solicitud : s)));
    return solicitud;
  }

  return {
    solicitudes,
    pendientes: solicitudes.filter((s) => s.estado === 'pendiente').length,
    cargando,
    errorCarga,
    disponible: USA_BASE_DE_DATOS,
    recargar,
    /** Atendida: liga la constancia que se generó para ella. */
    marcarLista: (id, constanciaId) => cambiarEstado(id, { estado: 'lista', constanciaId }),
    rechazar: (id, motivo) => cambiarEstado(id, { estado: 'rechazada', motivo }),
    regresarAPendiente: (id) => cambiarEstado(id, { estado: 'pendiente' }),
    /** El voucher como Blob (PDF o imagen), o null si ya no existe. */
    descargarVoucher: (id) => apiFetchArchivo(`/solicitudes/${id}/voucher`),
  };
}
