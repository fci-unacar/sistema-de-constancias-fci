import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { loadSession, saveSession, clearSession, secondsLeft } from '../lib/session';
import { USA_BASE_DE_DATOS } from '../lib/modo';
import { AUTH } from './useAuth';
import { MARGEN_REFRESH, refrescarSesion, useRenovarSesion } from './useRenovarSesion';

function estadoInicial() {
  if (!USA_BASE_DE_DATOS) return { status: AUTH.ANON, user: null };
  return loadSession() ? { status: AUTH.CHECKING, user: null } : { status: AUTH.ANON, user: null };
}

/**
 * Sesión del alumno en el portal (ver api/src/alumnos.js). Sin contraseña:
 * el alumno pide un código a su correo institucional y con él entra. La
 * sesión vive aparte de la de Secretaría (ver lib/session.js).
 *
 * El portal necesita la API: en modo de demostración (sin VITE_API_URL o
 * con VITE_AUTH_ENABLED apagado) no hay a dónde mandar las solicitudes,
 * así que `disponible` es false y la pantalla lo avisa.
 */
export function useAlumnoAuth() {
  const [state, setState] = useState(estadoInicial);

  // Validar la sesión guardada al abrir el portal.
  useEffect(() => {
    if (state.status !== AUTH.CHECKING) return undefined;
    let cancelado = false;
    (async () => {
      try {
        let session = loadSession();
        if (secondsLeft(session) < MARGEN_REFRESH) session = await refrescarSesion(session);
        const { user } = await apiFetch('/alumno/auth/me');
        if (!cancelado) setState({ status: AUTH.AUTHED, user });
      } catch (error) {
        if (error.status === 401 || error.status === 403) clearSession();
        if (!cancelado) setState({ status: AUTH.ANON, user: null, error: error.message });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [state.status]);

  useRenovarSesion(state.status === AUTH.AUTHED, () =>
    setState({ status: AUTH.ANON, user: null, error: 'Tu sesión expiró. Vuelve a entrar.' }),
  );

  /** Manda el código al correo. Devuelve { mensaje } para mostrar. */
  function pedirCodigo(email) {
    return apiFetch('/alumno/auth/codigo', { method: 'POST', body: JSON.stringify({ email }) });
  }

  /** Verifica el código y deja la sesión iniciada. Lanza ApiError si no sirve. */
  async function verificarCodigo(email, codigo) {
    const session = await apiFetch('/alumno/auth/verificar', {
      method: 'POST',
      body: JSON.stringify({ email, codigo }),
    });
    saveSession(session);
    setState({ status: AUTH.AUTHED, user: session.user });
  }

  async function logout() {
    try {
      await apiFetch('/alumno/auth/logout', { method: 'POST' });
    } catch {
      // Aunque la API no conteste, la sesión se cierra en este navegador.
    }
    clearSession();
    setState({ status: AUTH.ANON, user: null });
  }

  return {
    status: state.status,
    user: state.user,
    error: state.error ?? null,
    disponible: USA_BASE_DE_DATOS,
    pedirCodigo,
    verificarCodigo,
    logout,
  };
}
