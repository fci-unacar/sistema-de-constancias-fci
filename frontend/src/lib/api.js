/**
 * Punto único para hablar con la API (servicio de Render): inicio de
 * sesión (hooks/useAuth.js) y, con login real, el historial, los programas
 * y el calendario (ver lib/modo.js). La URL sale de una variable de
 * entorno, no del código.
 *
 * VITE_API_URL se define en Vercel (producción) y en frontend/.env.local
 * (desarrollo). Ver frontend/.env.example.
 */

import { loadSession } from './session';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** true si la API ya está configurada; permite seguir usando localStorage mientras no lo esté. */
export function apiConfigurada() {
  return BASE_URL !== '';
}

/**
 * Manda una petición a /health sin esperar la respuesta. En el plan
 * gratuito de Render la API se duerme y tarda ~1 minuto en despertar; si
 * se llama al abrir la página, para cuando la persona termina de escribir
 * su contraseña la API ya está lista (o casi).
 */
export function despertarApi() {
  if (!apiConfigurada()) return;
  fetch(apiUrl('/health')).catch(() => {
    // Solo es para despertarla; los errores reales los reporta la petición que sí importa.
  });
}

/** Une la URL base con una ruta, tolerando barras de sobra en cualquiera de las dos. */
export function apiUrl(path) {
  if (!apiConfigurada()) {
    throw new Error('VITE_API_URL no está configurada (ver frontend/.env.example).');
  }
  return `${BASE_URL.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
}

/** Error de la API, con el código HTTP para distinguir p. ej. 401 (sesión) de 503 (servidor). */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * fetch con JSON y manejo de error uniforme. Si hay sesión, manda el
 * access token; el mensaje de error es el que devolvió la API, si lo hay.
 * Para mandar un archivo, pasa el File/Blob como body y su Content-Type
 * en options.headers.
 */
export async function apiFetch(path, options = {}) {
  const response = await peticion(path, options);
  return response.status === 204 ? null : response.json();
}

/** Como apiFetch, pero para descargar un archivo: devuelve el Blob, o null si no existe (404). */
export async function apiFetchArchivo(path) {
  try {
    const response = await peticion(path);
    return await response.blob();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

async function peticion(path, options = {}) {
  const session = loadSession();
  let response;
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.', 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error ?? `La API respondió ${response.status} en ${path}`, response.status);
  }
  return response;
}
