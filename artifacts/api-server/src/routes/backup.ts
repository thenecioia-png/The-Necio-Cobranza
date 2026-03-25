import { Router, type IRouter } from "express";
import { db, usersTable, clientsTable, loansTable, installmentsTable, backupSettingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";

const router: IRouter = Router();

async function getBusinessId(req: any): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.businessId ?? null;
}

function fmtDate(val: string | Date | null | undefined): string {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtCurrency(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const n = Number(val);
  return isNaN(n) ? "" : `RD$ ${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    active: "Activo",
    paid: "Pagado",
    defaulted: "En mora",
    pending: "Pendiente",
    cancelled: "Cancelado",
  };
  return map[s] ?? s;
}

function freqLabel(f: string): string {
  const map: Record<string, string> = {
    daily: "Diaria",
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual",
  };
  return map[f] ?? f;
}

async function generateBackupData(businessId: number) {
  const clients = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.businessId, businessId));

  const clientMap = new Map(clients.map(c => [c.id, c]));

  const clientIds = clients.map(c => c.id);
  const loans = clientIds.length > 0
    ? await db
        .select()
        .from(loansTable)
        .where(clientIds.length === 1
          ? eq(loansTable.clientId, clientIds[0])
          : inArray(loansTable.clientId, clientIds))
    : [];

  const loanMap = new Map(loans.map(l => [l.id, l]));

  const loanIds = loans.map(l => l.id);
  const installments = loanIds.length > 0
    ? await db
        .select()
        .from(installmentsTable)
        .where(loanIds.length === 1
          ? eq(installmentsTable.loanId, loanIds[0])
          : inArray(installmentsTable.loanId, loanIds))
    : [];

  return { clients, clientMap, loans, loanMap, installments };
}

function buildExcel(data: Awaited<ReturnType<typeof generateBackupData>>): Buffer {
  const { clients, clientMap, loans, loanMap, installments } = data;
  const wb = XLSX.utils.book_new();

  // ── HOJA 1: RESUMEN GENERAL ──────────────────────────────────────────────
  const resumenRows = loans.map(l => {
    const client = clientMap.get(l.clientId);
    const loanInstallments = installments.filter(i => i.loanId === l.id);
    const pagadas = loanInstallments.filter(i => i.status === "paid").length;
    const pendientes = loanInstallments.filter(i => i.status === "pending").length;
    const montoPagado = loanInstallments
      .filter(i => i.status === "paid")
      .reduce((acc, i) => acc + Number(i.amount), 0);
    const saldoPendiente = Number(l.totalAmount) - montoPagado;

    return {
      "Cliente": client?.name ?? "",
      "Cédula": client?.cedula ?? "",
      "Teléfono": client?.phone ?? "",
      "Monto Prestado": Number(l.amount),
      "Total a Pagar": Number(l.totalAmount),
      "Monto Pagado": montoPagado,
      "Saldo Pendiente": saldoPendiente,
      "Cuotas Pagadas": pagadas,
      "Cuotas Pendientes": pendientes,
      "Total Cuotas": l.installmentsCount,
      "Frecuencia": freqLabel(l.frequency),
      "Fecha Inicio": fmtDate(l.startDate),
      "Estado Préstamo": statusLabel(l.status),
    };
  });

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows.length ? resumenRows : [{ "Sin datos": "" }]);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen General");

  // ── HOJA 2: CLIENTES ─────────────────────────────────────────────────────
  const clientRows = clients.map(c => ({
    "Nombre": c.name,
    "Apodo": c.apodo ?? "",
    "Cédula": c.cedula ?? "",
    "Teléfono": c.phone ?? "",
    "WhatsApp": c.whatsapp ?? "",
    "Dirección": c.address ?? "",
    "Sector": c.sector ?? "",
    "Ciudad": c.ciudad ?? "",
    "Estado": statusLabel(c.status),
    "Riesgo": c.riskScore ?? "",
    "Notas": c.notes ?? "",
    "Fecha de Registro": fmtDate(c.createdAt),
  }));

  const wsClientes = XLSX.utils.json_to_sheet(clientRows.length ? clientRows : [{ "Sin datos": "" }]);
  XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

  // ── HOJA 3: PRÉSTAMOS ────────────────────────────────────────────────────
  const loanRows = loans.map(l => {
    const client = clientMap.get(l.clientId);
    return {
      "Cliente": client?.name ?? "",
      "Cédula Cliente": client?.cedula ?? "",
      "Monto Prestado": Number(l.amount),
      "Tasa de Interés (%)": Number(l.interestRate),
      "Monto Total a Pagar": Number(l.totalAmount),
      "Número de Cuotas": l.installmentsCount,
      "Monto por Cuota": l.installmentsCount > 0
        ? Math.round((Number(l.totalAmount) / l.installmentsCount) * 100) / 100
        : 0,
      "Frecuencia": freqLabel(l.frequency),
      "Fecha de Inicio": fmtDate(l.startDate),
      "Estado": statusLabel(l.status),
      "Fecha de Creación": fmtDate(l.createdAt),
    };
  });

  const wsPrestamos = XLSX.utils.json_to_sheet(loanRows.length ? loanRows : [{ "Sin datos": "" }]);
  XLSX.utils.book_append_sheet(wb, wsPrestamos, "Préstamos");

  // ── HOJA 4: CUOTAS ───────────────────────────────────────────────────────
  const cuotaRows = installments.map(i => {
    const loan = loanMap.get(i.loanId);
    const client = loan ? clientMap.get(loan.clientId) : undefined;
    return {
      "Cliente": client?.name ?? "",
      "Cédula": client?.cedula ?? "",
      "Teléfono": client?.phone ?? "",
      "Monto Cuota": Number(i.amount),
      "Fecha de Vencimiento": fmtDate(i.dueDate),
      "Fecha de Pago": fmtDate(i.paidAt),
      "Método de Pago": i.paymentMethod ?? "",
      "Estado": statusLabel(i.status),
    };
  });

  const wsCuotas = XLSX.utils.json_to_sheet(cuotaRows.length ? cuotaRows : [{ "Sin datos": "" }]);
  XLSX.utils.book_append_sheet(wb, wsCuotas, "Cuotas");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function sendBackupEmail(
  to: string,
  smtpUser: string,
  smtpPass: string,
  excelBuffer: Buffer,
  dateLabel: string
) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"The Necio Cobranza" <${smtpUser}>`,
    to,
    subject: `Respaldo de datos – ${dateLabel}`,
    text: `Adjunto encontrará el respaldo completo de su cartera al ${dateLabel}.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #e11d48;">The Necio Cobranza</h2>
        <p>Respaldo de datos generado el <strong>${dateLabel}</strong>.</p>
        <p>El archivo Excel adjunto contiene 4 hojas:</p>
        <ul>
          <li><strong>Resumen General</strong> – Vista rápida de todos los préstamos con saldo pendiente</li>
          <li><strong>Clientes</strong> – Información completa de cada cliente</li>
          <li><strong>Préstamos</strong> – Detalle de cada préstamo otorgado</li>
          <li><strong>Cuotas</strong> – Historial completo de cuotas y pagos</li>
        </ul>
        <p style="color: #6b7280; font-size: 12px;">Este correo fue enviado automáticamente por The Necio Cobranza.</p>
      </div>
    `,
    attachments: [
      {
        filename: `respaldo-necio-${dateLabel.replace(/\s/g, "-")}.xlsx`,
        content: excelBuffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
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

  // Strip all whitespace from App Password — Google displays it with spaces but they must be removed
  const cleanedPass = smtpPass ? String(smtpPass).replace(/\s+/g, "") : smtpPass;

  const updates: any = {
    email,
    frequency,
    enabled: enabled !== false,
    updatedAt: new Date(),
    ...(smtpUser !== undefined ? { smtpUser } : {}),
    ...(cleanedPass ? { smtpPass: cleanedPass } : {}),
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
    const excelBuffer = buildExcel(data);
    const dateLabel = new Date().toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });
    await sendBackupEmail(settings.email, settings.smtpUser, settings.smtpPass, excelBuffer, dateLabel);

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

// GET /api/backup/download – download full Excel report
router.get("/download", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const data = await generateBackupData(businessId);
  const excelBuffer = buildExcel(data);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `respaldo-necio-${dateStr}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(excelBuffer);
});

export default router;
