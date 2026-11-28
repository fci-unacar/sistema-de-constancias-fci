import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { loadSession, saveSession, clearSession, secondsLeft } from '../lib/session';

/** Cuántos segundos antes de que expire el access token se pide uno nuevo. */
export const MARGEN_REFRESH = 60;

/** Cambia el refresh token guardado por una sesión nueva y la guarda. */
export async function refrescarSesion(session) {
  const nueva = await apiFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  saveSession(nueva);
  return nueva;
}

/**
 * Mientras `activa` sea true, renueva el access token un minuto antes de
 * que expire. Si la API dice que la sesión ya no sirve (401), la borra y
 * llama a onExpirada. Lo usan el panel de Secretaría (useAuth) y el portal
 * de alumnos (useAlumnoAuth).
 */
export function useRenovarSesion(activa, onExpirada) {
  const [vuelta, setVuelta] = useState(0);
  const onExpiradaRef = useRef(onExpirada);
  useEffect(() => {
    onExpiradaRef.current = onExpirada;
  });

  useEffect(() => {
    if (!activa) return undefined;
    const session = loadSession();
    if (!session) return undefined;
    const espera = Math.max(secondsLeft(session) - MARGEN_REFRESH, 5) * 1000;
    const timer = setTimeout(async () => {
      try {
        await refrescarSesion(session);
        setVuelta((v) => v + 1); // reprograma el siguiente refresh
      } catch (error) {
        if (error.status === 401) {
          clearSession();
          onExpiradaRef.current();
        }
      }
    }, espera);
    return () => clearTimeout(timer);
  }, [activa, vuelta]);
}
