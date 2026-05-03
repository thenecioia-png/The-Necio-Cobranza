import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@neciocobranza.com";

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendConfirmationCode(
  to: string,
  code: string,
  action: string,
): Promise<{ sent: boolean; previewUrl?: string; error?: string }> {
  const subject = `Código de confirmación - ${action}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff;border-radius:16px;">
      <h2 style="color:#e11d48;margin-top:0;">The Necio Cobranza</h2>
      <p>Estás a punto de <strong>${action}</strong>.</p>
      <p>Tu código de confirmación es:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#1a1a1a;padding:16px 24px;border-radius:12px;text-align:center;color:#e11d48;margin:16px 0;">
        ${code}
      </div>
      <p style="color:#888;font-size:12px;">Si no solicitaste esta acción, ignora este correo.</p>
    </div>
  `;

  if (!transporter) {
    return { sent: false, error: "Email no configurado" };
  }

  try {
    await transporter.sendMail({
      from: `"The Necio Cobranza" <${EMAIL_FROM}>`,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (e: any) {
    return { sent: false, error: e.message };
  }
}

export async function sendPasswordReset(
  to: string,
  token: string,
): Promise<{ sent: boolean; error?: string }> {
  const resetUrl = `${process.env.APP_URL ?? "https://necio-cobranza-production.up.railway.app"}/reset-password?token=${token}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff;border-radius:16px;">
      <h2 style="color:#e11d48;margin-top:0;">The Necio Cobranza</h2>
      <p>Solicitaste restablecer tu contraseña.</p>
      <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
      <a href="${resetUrl}" style="display:inline-block;background:#e11d48;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:bold;margin:16px 0;">
        Restablecer Contraseña
      </a>
      <p style="color:#888;font-size:12px;">Si no solicitaste esto, ignora este correo. El enlace expira en 1 hora.</p>
    </div>
  `;

  if (!transporter) {
    return { sent: false, error: "Email no configurado" };
  }

  try {
    await transporter.sendMail({
      from: `"The Necio Cobranza" <${EMAIL_FROM}>`,
      to,
      subject: "Restablecer contraseña - The Necio Cobranza",
      html,
    });
    return { sent: true };
  } catch (e: any) {
    return { sent: false, error: e.message };
  }
}

export function isEmailConfigured(): boolean {
  return !!transporter;
}
