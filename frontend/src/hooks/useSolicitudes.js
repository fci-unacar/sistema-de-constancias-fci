import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiFetchArchivo } from '../lib/api';
import { USA_BASE_DE_DATOS } from '../lib/modo';
import { ESTADO_SOLICITUD, NIVEL_ATRASO, nivelAtraso } from '../constants/solicitudes';

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

  /**
   * Manda una operación sobre una solicitud, reemplaza la fila con lo que
   * devuelve la API y regresa la respuesta completa ({ solicitud, notificacion? }). Si responde 409 (otra persona la tomó o ya la
   * atendió), recarga la bandeja para que se vea quién y vuelve a lanzar el
   * error con el mensaje para mostrar.
   */
  async function operar(id, path, options) {
    try {
      // La respuesta trae la solicitud y, al cerrarla, cómo le fue al aviso por correo.
      const respuesta = await apiFetch(path, options);
      setSolicitudes((prev) => prev.map((s) => (s.id === id ? respuesta.solicitud : s)));
      return respuesta;
    } catch (error) {
      if (error.status === 409) cargar();
      throw error;
    }
  }

  const cambiarEstado = (id, cambios) =>
    operar(id, `/solicitudes/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) });

  const ahora = new Date();
  const pendientes = solicitudes.filter((s) => s.estado === ESTADO_SOLICITUD.PENDIENTE);

  return {
    solicitudes,
    pendientes: pendientes.length,
    atrasadas: pendientes.filter((s) => nivelAtraso(s, ahora) === NIVEL_ATRASO.ATRASADA).length,
    cargando,
    errorCarga,
    disponible: USA_BASE_DE_DATOS,
    recargar,
    /** La aparta a nombre de quien la va a atender; lanza ApiError 409 si la tiene otra persona. */
    tomar: (id) => operar(id, `/solicitudes/${id}/tomar`, { method: 'POST' }),
    /** La libera sin atenderla. */
    soltar: (id) => operar(id, `/solicitudes/${id}/tomar`, { method: 'DELETE' }),
    /** Atendida: liga la constancia que se generó para ella. */
    marcarLista: (id, constanciaId) => cambiarEstado(id, { estado: 'lista', constanciaId }),
    rechazar: (id, motivo) => cambiarEstado(id, { estado: 'rechazada', motivo }),
    regresarAPendiente: (id) => cambiarEstado(id, { estado: 'pendiente' }),
    /** El voucher como Blob (PDF o imagen), o null si ya no existe. */
    descargarVoucher: (id) => apiFetchArchivo(`/solicitudes/${id}/voucher`),
  };
}
