import { Router, type IRouter } from "express";
import { db, usersTable, clientsTable, loansTable, installmentsTable, backupSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

async function getBusinessId(req: any): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.businessId ?? null;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

async function generateBackupData(businessId: number) {
  const clients = await db.select().from(clientsTable).where(eq(clientsTable.businessId, businessId));
  const loans = await db.select().from(loansTable).where(eq(loansTable.businessId, businessId));
  const installments = await db.select().from(installmentsTable);

  const loanIds = new Set(loans.map(l => l.id));
  const filteredInstallments = installments.filter(i => loanIds.has(i.loanId));

  const clientsCsv = toCsv(clients.map(c => ({
    id: c.id,
    nombre: c.name,
    apodo: c.apodo ?? "",
    telefono: c.phone ?? "",
    whatsapp: c.whatsapp ?? "",
    direccion: c.address ?? "",
    sector: c.sector ?? "",
    ciudad: c.ciudad ?? "",
    cedula: c.cedula ?? "",
    estado: c.status,
    riesgo: c.riskScore,
    notas: c.notes ?? "",
    creado: c.createdAt?.toISOString() ?? "",
  })));

  const loansCsv = toCsv(loans.map(l => ({
    id: l.id,
    clienteId: l.clientId,
    monto: l.amount,
    tasaInteres: l.interestRate,
    cuotas: l.installments,
    frecuencia: l.frequency,
    montoTotal: l.totalAmount,
    montoCuota: l.installmentAmount,
    estado: l.status,
    creado: l.createdAt?.toISOString() ?? "",
  })));

  const installmentsCsv = toCsv(filteredInstallments.map(i => ({
    id: i.id,
    prestamoId: i.loanId,
    numeroCuota: i.installmentNumber,
    monto: i.amount,
    montoPagado: i.amountPaid,
    fechaVencimiento: i.dueDate?.toISOString() ?? "",
    fechaPago: i.paidAt?.toISOString() ?? "",
    estado: i.status,
  })));

  return { clientsCsv, loansCsv, installmentsCsv, clients, loans, installments: filteredInstallments };
}

async function sendBackupEmail(
  to: string,
  smtpUser: string,
  smtpPass: string,
  data: { clientsCsv: string; loansCsv: string; installmentsCsv: string }
) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const now = new Date().toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });

  await transporter.sendMail({
    from: `"The Necio Cobranza" <${smtpUser}>`,
    to,
    subject: `Respaldo de datos – ${now}`,
    text: `Adjunto encontrará el respaldo de datos de su cartera al ${now}.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #e11d48;">The Necio Cobranza</h2>
        <p>Respaldo de datos generado el <strong>${now}</strong>.</p>
        <p>Se incluyen 3 archivos CSV:</p>
        <ul>
          <li><strong>clientes.csv</strong> – Lista de clientes registrados</li>
          <li><strong>prestamos.csv</strong> – Préstamos activos y cerrados</li>
          <li><strong>cuotas.csv</strong> – Historial de cuotas y pagos</li>
        </ul>
        <p style="color: #6b7280; font-size: 12px;">Este correo fue enviado automáticamente por The Necio Cobranza.</p>
      </div>
    `,
    attachments: [
      { filename: "clientes.csv", content: data.clientsCsv, contentType: "text/csv" },
      { filename: "prestamos.csv", content: data.loansCsv, contentType: "text/csv" },
      { filename: "cuotas.csv", content: data.installmentsCsv, contentType: "text/csv" },
    ],
  });
}

// GET /api/backup/settings
router.get("/settings", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const [settings] = await db
    .select()
    .from(backupSettingsTable)
    .where(eq(backupSettingsTable.businessId, businessId))
    .limit(1);

  if (!settings) return res.json(null);

  res.json({
    email: settings.email,
    frequency: settings.frequency,
    enabled: settings.enabled,
    smtpUser: settings.smtpUser ?? "",
    smtpPassSet: !!settings.smtpPass,
    lastSentAt: settings.lastSentAt?.toISOString() ?? null,
  });
});

// POST /api/backup/settings
router.post("/settings", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const { email, frequency, enabled, smtpUser, smtpPass } = req.body;
  if (!email || !frequency) return res.status(400).json({ error: "email y frequency requeridos" });

  const [existing] = await db
    .select()
    .from(backupSettingsTable)
    .where(eq(backupSettingsTable.businessId, businessId))
    .limit(1);

  const updates: any = {
    email,
    frequency,
    enabled: enabled !== false,
    updatedAt: new Date(),
    ...(smtpUser !== undefined ? { smtpUser } : {}),
    ...(smtpPass ? { smtpPass } : {}),
  };

  if (existing) {
    await db
      .update(backupSettingsTable)
      .set(updates)
      .where(eq(backupSettingsTable.businessId, businessId));
  } else {
    await db.insert(backupSettingsTable).values({
      businessId,
      email,
      frequency,
      enabled: enabled !== false,
      smtpUser: smtpUser ?? null,
      smtpPass: smtpPass ?? null,
    });
  }

  res.json({ ok: true });
});

// POST /api/backup/send – send backup email now
router.post("/send", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const [settings] = await db
    .select()
    .from(backupSettingsTable)
    .where(eq(backupSettingsTable.businessId, businessId))
    .limit(1);

  if (!settings) return res.status(400).json({ error: "Configura el respaldo primero" });
  if (!settings.smtpUser || !settings.smtpPass) {
    return res.status(400).json({ error: "Configura las credenciales de correo primero" });
  }

  try {
    const data = await generateBackupData(businessId);
    await sendBackupEmail(settings.email, settings.smtpUser, settings.smtpPass, data);

    await db
      .update(backupSettingsTable)
      .set({ lastSentAt: new Date(), updatedAt: new Date() })
      .where(eq(backupSettingsTable.businessId, businessId));

    res.json({ ok: true, sentAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Backup email error:", err);
    res.status(500).json({ error: "No se pudo enviar el correo: " + (err.message ?? "Error desconocido") });
  }
});

// GET /api/backup/download?type=clientes|prestamos|cuotas
router.get("/download", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const type = (req.query.type as string) || "clientes";
  const data = await generateBackupData(businessId);

  const csvMap: Record<string, string> = {
    clientes: data.clientsCsv,
    prestamos: data.loansCsv,
    cuotas: data.installmentsCsv,
  };

  const csv = csvMap[type] || data.clientsCsv;
  const filename = `${type}-${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csv);
});

export default router;
