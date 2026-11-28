/**
 * Configuración leída de process.env. En local, dotenv carga api/.env;
 * en Render las variables vienen del panel del servicio (ver render.yaml).
 * No hay valores por defecto para las llaves: si faltan, la API arranca
 * igual pero en modo "sin base de datos" (ver server.js) — así el servicio
 * puede desplegarse antes de que exista el proyecto de Supabase.
 */
import 'dotenv/config';

export const config = {
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  port: Number(process.env.PORT) || 3000,
  /** Tabla contra la que /health hace su consulta mínima. */
  healthTable: process.env.HEALTH_TABLE ?? 'constancias',
  /** Dominio de correo con el que entran los alumnos al portal (ver alumnos.js). */
  alumnosDominio: (process.env.ALUMNOS_DOMINIO ?? 'mail.unacar.mx').trim().toLowerCase(),

  // Correo saliente del sistema (avisos a los alumnos, ver correo.js). Sin
  // SMTP_USER y SMTP_PASS no se manda ningún aviso; todo lo demás funciona.
  smtpHost: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT) || 465,
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpRemitente: process.env.SMTP_REMITENTE ?? 'Sistema de Constancias FCI',
  /** Enlace al portal de alumnos que va en los avisos. */
  portalAlumnosUrl: `${(process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '')}/alumnos`,
};

/** La base de datos solo se considera configurada si están la URL y la llave. */
export function supabaseConfigurado() {
  return config.supabaseUrl !== '' && config.supabaseServiceRoleKey !== '';
}
