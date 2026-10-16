// Envío de correos con la cuenta de Gmail de VenusTech (SMTP + contraseña de aplicación).
// Si no está configurado (.env), el correo se muestra en la terminal del servidor en lugar de enviarse.
import nodemailer from 'nodemailer';
import { SITE } from '../data/site';
import { env } from './secretos';

export { env };

/** Correo que recibe avisos y enlaces de recuperación (no lo decide el visitante) */
export const correoAdmin = () => env('ADMIN_EMAIL') ?? SITE.email;

let transporte: nodemailer.Transporter | null | undefined;
function obtenerTransporte() {
  if (transporte !== undefined) return transporte;
  const usuario = env('SMTP_USER');
  const clave = env('SMTP_PASS');
  transporte =
    usuario && clave
      ? nodemailer.createTransport({
          host: env('SMTP_HOST') ?? 'smtp.gmail.com',
          port: Number(env('SMTP_PORT') ?? 465),
          secure: Number(env('SMTP_PORT') ?? 465) === 465,
          auth: { user: usuario, pass: clave.replace(/\s/g, '') },
        })
      : null;
  return transporte;
}

export function correoConfigurado() {
  return obtenerTransporte() !== null;
}

export async function enviarCorreo(opts: { asunto: string; texto: string; responderA?: string }) {
  const t = obtenerTransporte();
  const para = correoAdmin();
  if (!t) {
    console.log(`\n──── Correo (SMTP sin configurar, no se envió) ────\nPara: ${para}\nAsunto: ${opts.asunto}\n\n${opts.texto}\n──────────────────────────────────────────────\n`);
    return false;
  }
  try {
    await t.sendMail({
      from: `"${SITE.name}" <${env('SMTP_USER')}>`,
      to: para,
      subject: opts.asunto,
      text: opts.texto,
      ...(opts.responderA ? { replyTo: opts.responderA } : {}),
    });
    return true;
  } catch (e) {
    console.error('No se pudo enviar el correo:', (e as Error).message);
    return false;
  }
}
