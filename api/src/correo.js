/**
 * Correos que manda el sistema (no los de inicio de sesión: esos los manda
 * Supabase Auth con su plantilla).
 *
 * Hoy solo uno: avisarle al alumno que su solicitud quedó lista o fue
 * rechazada (ver solicitudes.js). Sale por SMTP con la cuenta de Gmail
 * institucional, la misma que Supabase usa para los códigos; se configura
 * con SMTP_USER y SMTP_PASS (contraseña de aplicación de Gmail). Sin ellas
 * el sistema funciona igual, solo no avisa por correo.
 */
import nodemailer from 'nodemailer';
import { config } from './config.js';

/** Igual que TIPO_NOMBRE_COMPLETO en el frontend. */
const NOMBRE_TIPO = {
  normal: 'constancia de estudios (reinscripción)',
  promedio: 'constancia de promedio',
  'buena-conducta': 'carta de buena conducta',
  terminacion: 'constancia de terminación de estudios',
};

export const NOTIFICACION = {
  ENVIADA: 'enviada',
  FALLO: 'fallo',
  SIN_CONFIGURAR: 'sin-configurar',
};

export function correoConfigurado() {
  return config.smtpUser !== '' && config.smtpPass !== '';
}

let transporte = null;

function getTransporte() {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
      // Que un SMTP lento no deje a Secretaría esperando.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporte;
}

/** El nombre y el motivo los escribe una persona: se escapan antes de ir al HTML. */
function html(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Asunto, texto plano y HTML del aviso, según el estado de la solicitud. */
export function armarAviso({ nombre, tipo, estado, motivo, folio }) {
  const tipoTexto = NOMBRE_TIPO[tipo] ?? 'constancia';
  const portal = config.portalAlumnosUrl;

  if (estado === 'lista') {
    const conFolio = folio ? ` con el folio ${folio}` : '';
    const parrafos = [
      `Hola, ${nombre}:`,
      `Tu solicitud de ${tipoTexto} fue aprobada y tu constancia ya está lista${conFolio}.`,
      'Pasa a recogerla a la Secretaría Académica de la Facultad de Ciencias de la Información.',
    ];
    return {
      asunto: `Tu ${tipoTexto} está lista - Constancias FCI`,
      texto: `${parrafos.join('\n\n')}\n\nPuedes ver tus solicitudes en ${portal}`,
      html: plantilla(parrafos, portal),
    };
  }

  const parrafos = [
    `Hola, ${nombre}:`,
    `Tu solicitud de ${tipoTexto} fue rechazada.`,
    `Motivo: ${motivo || 'sin especificar'}`,
    'Corrige lo necesario y manda una solicitud nueva desde el portal.',
  ];
  return {
    asunto: `Tu solicitud de ${tipoTexto} fue rechazada - Constancias FCI`,
    texto: `${parrafos.join('\n\n')}\n\nPortal: ${portal}`,
    html: plantilla(parrafos, portal),
  };
}

function plantilla(parrafos, portal) {
  return [
    '<h2>Sistema de Constancias FCI</h2>',
    ...parrafos.map((p) => `<p>${html(p)}</p>`),
    `<p><a href="${html(portal)}">Ver mis solicitudes</a></p>`,
    '<p style="color:#666;font-size:12px">Este es un correo automático, no lo respondas.</p>',
  ].join('\n');
}

/**
 * Le avisa al alumno que su solicitud quedó lista o fue rechazada. Nunca
 * lanza: si el correo no sale, la solicitud ya cambió de estado igual, y
 * se devuelve cómo le fue para que Secretaría lo sepa.
 *
 * @returns {Promise<'enviada'|'fallo'|'sin-configurar'>}
 */
export async function avisarAlumno({ email, nombre, tipo, estado, motivo, folio }) {
  if (!correoConfigurado()) return NOTIFICACION.SIN_CONFIGURAR;

  const aviso = armarAviso({ nombre, tipo, estado, motivo, folio });
  try {
    await getTransporte().sendMail({
      from: { name: config.smtpRemitente, address: config.smtpUser },
      to: email,
      subject: aviso.asunto,
      text: aviso.texto,
      html: aviso.html,
    });
    return NOTIFICACION.ENVIADA;
  } catch (error) {
    console.error('No se pudo avisar al alumno por correo:', error.code ?? '', error.message);
    return NOTIFICACION.FALLO;
  }
}
