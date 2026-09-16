import nodemailer from "nodemailer";
import env from "../../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
});

function link(path, token) {
  return `${env.APP_URL}${path}?token=${encodeURIComponent(token)}`;
}

export const mailer = {
  async sendVerificationEmail({ to, token }) {
    const url = link("/verificar-correo", token);
    await transporter.sendMail({
      from: env.MAIL_FROM, to, subject: "Verificá tu correo en InmuConnect",
      text: `Verificá tu correo para activar tu cuenta: ${url}\n\nEste enlace vence en ${env.EMAIL_VERIFICATION_TTL_MINUTES} minutos.`,
    });
  },
  async sendPasswordResetEmail({ to, token }) {
    const url = link("/restablecer-contrasena", token);
    await transporter.sendMail({
      from: env.MAIL_FROM, to, subject: "Restablecé tu contraseña de InmuConnect",
      text: `Solicitaste restablecer tu contraseña: ${url}\n\nEste enlace vence en ${env.PASSWORD_RESET_TTL_MINUTES} minutos.`,
    });
  },
  async sendSearchAlertEmail({ to, alertName, property }) {
    const url = `${env.APP_URL}/detail/${property.id}`;
    await transporter.sendMail({
      from: env.MAIL_FROM, to, subject: "Nueva propiedad que coincide con tu alerta",
      text: `${alertName ? `Tu alerta "${alertName}"` : "Una de tus alertas"} coincide con ${property.title}.\n${property.operationType} · ${property.propertyType}\n${property.city?.name ?? ""}\n${property.currency} ${property.price}\n\nVer propiedad: ${url}`,
    });
  },
};
