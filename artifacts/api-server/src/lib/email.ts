import nodemailer from "nodemailer";

export interface SmtpConfig {
  smtpUser: string;
  smtpPass: string;
}

/**
 * Envía un comprobante de pago en PDF al cliente por Gmail.
 */
export async function sendReceiptEmail(
  config: SmtpConfig,
  options: {
    to: string;
    clienteNombre: string;
    businessName: string;
    pdfBuffer: Buffer;
    folio: number;
    monto: number;
    concepto: string;
    fecha: string;
  }
): Promise<void> {
  const { to, clienteNombre, businessName, pdfBuffer, folio, monto, concepto, fecha } = options;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });

  const montoFmt = `RD$ ${monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;
  const fechaFmt = new Date(fecha + "T12:00:00").toLocaleDateString("es-DO", {
    year: "numeric", month: "long", day: "numeric",
  });
  const folioStr = String(folio).padStart(6, "0");

  await transporter.sendMail({
    from: `"${businessName}" <${config.smtpUser}>`,
    to,
    subject: `Comprobante de pago #${folioStr} – ${businessName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #e11d48; margin-bottom: 4px;">${businessName}</h2>
        <p style="color: #6b7280; font-size: 13px; margin-top: 0;">Comprobante de pago #${folioStr}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
        <p>Hola <strong>${clienteNombre}</strong>,</p>
        <p>Hemos confirmado tu pago exitosamente:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f9fafb;">
            <td style="padding: 10px 14px; font-weight: bold; color: #374151;">Monto</td>
            <td style="padding: 10px 14px; color: #111827; font-size: 18px; font-weight: bold;">${montoFmt}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #374151;">Concepto</td>
            <td style="padding: 10px 14px; color: #111827;">${concepto}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px 14px; font-weight: bold; color: #374151;">Fecha</td>
            <td style="padding: 10px 14px; color: #111827;">${fechaFmt}</td>
          </tr>
        </table>
        <p>Adjunto encontrarás el comprobante en PDF.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
        <p style="color: #9ca3af; font-size: 11px;">Este correo fue generado automáticamente por ${businessName}.</p>
      </div>
    `,
    attachments: [
      {
        filename: `comprobante-${folioStr}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
