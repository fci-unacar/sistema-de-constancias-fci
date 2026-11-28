/**
 * Sesión del usuario (tokens que devuelve la API en /auth/login).
 *
 * Vive en sessionStorage, no en localStorage: se borra al cerrar el
 * navegador, así que en un equipo compartido de la Secretaría nadie queda
 * con la sesión de otra persona abierta al día siguiente.
 *
 * El portal de alumnos guarda su sesión aparte (otra clave), para que abrir
 * /alumnos en el mismo navegador no pise la sesión de Secretaría.
 */

import { ES_PORTAL_ALUMNOS } from './portal';

const KEY = ES_PORTAL_ALUMNOS ? 'constancias-fci-sesion-alumno-v1' : 'constancias-fci-sesion-v1';

export function loadSession() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('No se pudo guardar la sesión:', error);
  }
}

export function clearSession() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Sin sessionStorage no hay nada que borrar.
  }
}

/** Segundos que le quedan al access token (negativo si ya expiró). */
export function secondsLeft(session) {
  return session.expiresAt - Date.now() / 1000;
}
