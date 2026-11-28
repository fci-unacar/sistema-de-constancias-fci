import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { PROGRAMAS_INICIALES } from '../data/programas';

/**
 * Lo que necesita el panel del alumno: sus solicitudes (solo las suyas, la
 * API filtra por su correo) y el catálogo de programas para el formulario.
 */
export function useMisSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [programas, setProgramas] = useState(PROGRAMAS_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // Todo el setState va en los callbacks de la promesa: así se puede llamar desde el efecto de carga.
  const cargar = useCallback(
    () =>
      apiFetch('/alumno/solicitudes')
        .then(({ solicitudes: deLaApi }) => {
          setSolicitudes(deLaApi);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message))
        .finally(() => setCargando(false)),
    [],
  );

  const recargar = useCallback(() => {
    setCargando(true);
    return cargar();
  }, [cargar]);

  useEffect(() => {
    cargar();
    apiFetch('/alumno/programas')
      .then(({ programas: deLaBase }) => deLaBase.length > 0 && setProgramas(deLaBase))
      .catch((error) => console.warn('No se pudo leer el catálogo de programas:', error.message));
  }, [cargar]);

  /**
   * Manda la solicitud: el voucher va como cuerpo y los datos en el
   * encabezado X-Solicitud (ver api/src/alumnos.js). Lanza ApiError con el
   * mensaje para mostrar si la API la rechaza.
   */
  async function enviarSolicitud({ nombre, matricula, programa, tipo, voucher, voucherTipo }) {
    const datos = { nombre, matricula, programa, tipo, archivo: voucher.name };
    const { solicitud } = await apiFetch('/alumno/solicitudes', {
      method: 'POST',
      body: voucher,
      headers: { 'Content-Type': voucherTipo, 'X-Solicitud': encodeURIComponent(JSON.stringify(datos)) },
    });
    setSolicitudes((prev) => [solicitud, ...prev]);
    return solicitud;
  }

  return { solicitudes, programas, cargando, errorCarga, recargar, enviarSolicitud };
}
