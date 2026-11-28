import { useEffect, useState } from 'react';
import { apiConfigurada, apiFetch } from '../lib/api';
import { loadSession, saveSession, clearSession, secondsLeft } from '../lib/session';
import { MARGEN_REFRESH, refrescarSesion, useRenovarSesion } from './useRenovarSesion';

export const AUTH = {
  CHECKING: 'checking', // validando una sesión guardada
  ANON: 'anon', // hay que iniciar sesión
  AUTHED: 'authed',
};

/**
 * Las credenciales solo se validan con VITE_AUTH_ENABLED=true. Por ahora
 * está apagado a propósito: la pantalla de login se muestra igual, pero
 * entra con cualquier correo y contraseña, sin llamar a la API, hasta que
 * esté listo Supabase (ver README, "Inicio de sesión").
 */
export const AUTH_ACTIVADA = import.meta.env.VITE_AUTH_ENABLED === 'true';

/**
 * Con el login apagado, "Crear o cambiar mi contraseña" también se simula
 * para poder mostrar las pantallas sin Supabase: no se manda ningún correo,
 * la pantalla indica este código y la contraseña no se guarda en ningún lado.
 */
const CODIGO_DEMO = '123456';

/** Pausa breve para que el modo demostración se sienta como una llamada real. */
const esperaDemo = () => new Promise((resolve) => setTimeout(resolve, 600));

function estadoInicial() {
  if (!AUTH_ACTIVADA) {
    const session = loadSession();
    return session?.sinValidar
      ? { status: AUTH.AUTHED, user: session.user }
      : { status: AUTH.ANON, user: null };
  }
  // Con el login activado pero sin API no hay forma de validar a nadie: se
  // queda en la pantalla de login con un aviso.
  if (!apiConfigurada()) return { status: AUTH.ANON, user: null };
  return loadSession() ? { status: AUTH.CHECKING, user: null } : { status: AUTH.ANON, user: null };
}

/**
 * Sesión del usuario contra la API (ver api/src/auth.js). Al abrir la app
 * valida la sesión guardada, y mientras está abierta renueva el access
 * token un minuto antes de que expire.
 */
export function useAuth() {
  const [state, setState] = useState(estadoInicial);

  // Validar la sesión guardada al abrir la app.
  useEffect(() => {
    if (state.status !== AUTH.CHECKING) return;
    let cancelled = false;
    (async () => {
      try {
        let session = loadSession();
        if (secondsLeft(session) < MARGEN_REFRESH) session = await refrescarSesion(session);
        const { user } = await apiFetch('/auth/me');
        if (!cancelled) setState({ status: AUTH.AUTHED, user });
      } catch (error) {
        // 403: la sesión es válida pero el correo ya no está autorizado.
        if (error.status === 401 || error.status === 403) clearSession();
        if (!cancelled) setState({ status: AUTH.ANON, user: null, error: error.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status]);

  // Renovar el token antes de que expire.
  useRenovarSesion(AUTH_ACTIVADA && state.status === AUTH.AUTHED, () =>
    setState({ status: AUTH.ANON, user: null, error: 'Tu sesión expiró. Inicia sesión de nuevo.' }),
  );

  /** Sin validación (modo demostración): entra con el correo tal cual, sin llamar a la API. */
  function entrarSinValidar(email) {
    const user = { email: email.trim() };
    saveSession({ sinValidar: true, user });
    setState({ status: AUTH.AUTHED, user });
  }

  /** Lanza ApiError con el mensaje para mostrar si las credenciales no sirven. */
  async function login(email, password) {
    if (!AUTH_ACTIVADA) return entrarSinValidar(email);
    const session = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveSession(session);
    setState({ status: AUTH.AUTHED, user: session.user });
  }

  /** Pide a la API que mande un código al correo. Devuelve { mensaje } para mostrar. */
  async function pedirCodigo(email) {
    if (!AUTH_ACTIVADA) {
      await esperaDemo();
      return {
        mensaje: `Modo demostración: no se envía ningún correo. Usa el código ${CODIGO_DEMO}.`,
      };
    }
    return apiFetch('/auth/codigo', { method: 'POST', body: JSON.stringify({ email }) });
  }

  /** Verifica el código, guarda la contraseña nueva y deja la sesión iniciada. */
  async function crearPassword(email, codigo, password) {
    if (!AUTH_ACTIVADA) {
      await esperaDemo();
      if (codigo !== CODIGO_DEMO) throw new Error('El código no es válido o ya expiró. Pide uno nuevo.');
      return entrarSinValidar(email);
    }
    const session = await apiFetch('/auth/crear-password', {
      method: 'POST',
      body: JSON.stringify({ email, codigo, password }),
    });
    saveSession(session);
    setState({ status: AUTH.AUTHED, user: session.user });
  }

  async function logout() {
    if (AUTH_ACTIVADA) await cerrarEnApi();
    clearSession();
    setState({ status: AUTH.ANON, user: null });
  }

  async function cerrarEnApi() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Aunque la API no conteste, la sesión se cierra en este navegador.
    }
  }

  return {
    status: state.status,
    user: state.user,
    error: state.error ?? null,
    // Sin validación no hace falta la API para entrar.
    configurada: !AUTH_ACTIVADA || apiConfigurada(),
    activada: AUTH_ACTIVADA,
    login,
    pedirCodigo,
    crearPassword,
    logout,
  };
}
