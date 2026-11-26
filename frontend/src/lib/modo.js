/**
 * Dónde viven los datos (historial y programas).
 *
 * Con el login real activado (VITE_AUTH_ENABLED=true y VITE_API_URL
 * definida) todo va a la base de datos a través de la API: es lo que corre
 * en producción. Sin login real es el modo de demostración y cada
 * navegador guarda sus datos en localStorage.
 *
 * Se lee de variables de entorno de Vite, así que es fijo mientras la app
 * está cargada.
 */
import { apiConfigurada } from './api';

export const USA_BASE_DE_DATOS = import.meta.env.VITE_AUTH_ENABLED === 'true' && apiConfigurada();
