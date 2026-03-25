import { Router, type IRouter } from "express";
import { db, loanContractsTable, loansTable, clientsTable, installmentsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { decrypt } from "../lib/encryption";

const router: IRouter = Router();

async function getBusinessId(req: any): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.businessId ?? null;
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  next();
}

function buildContractHtml(client: any, loan: any, installments: any[], businessName: string): string {
  const today = new Date().toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });
  const totalPaid = installments.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalPending = installments.filter(i => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0);

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Arial', sans-serif; color: #1a1a1a; max-width: 700px; margin: 0 auto; padding: 24px; }
  .header { text-align: center; border-bottom: 3px solid #dc2626; padding-bottom: 16px; margin-bottom: 24px; }
  .company { font-size: 22px; font-weight: bold; color: #dc2626; letter-spacing: 2px; }
  .title { font-size: 18px; font-weight: bold; margin: 8px 0; color: #1a1a1a; }
  .subtitle { font-size: 13px; color: #555; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: bold; color: #dc2626; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 13px; }
  .label { color: #555; }
  .value { font-weight: 500; }
  .highlight { background: #fff5f5; border: 1px solid #fecaca; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
  .highlight .amount { font-size: 24px; font-weight: bold; color: #dc2626; }
  .clause { font-size: 12px; color: #444; margin: 6px 0; line-height: 1.6; }
  .clause span { font-weight: bold; color: #dc2626; }
  .signature-section { margin-top: 40px; border-top: 2px dashed #ccc; padding-top: 20px; }
  .sig-box { border-bottom: 1px solid #333; height: 60px; margin: 8px 0; }
  .sig-label { font-size: 11px; color: #666; }
</style></head>
<body>
  <div class="header">
    <div class="company">THE NECIO COBRANZA</div>
    <div class="title">CONTRATO DE PRÉSTAMO PERSONAL</div>
    <div class="subtitle">Santo Domingo, República Dominicana &nbsp;|&nbsp; Fecha: ${today}</div>
  </div>

  <div class="section">
    <div class="section-title">Partes del Contrato</div>
    <div class="row"><span class="label">Prestamista:</span><span class="value">${businessName}</span></div>
    <div class="row"><span class="label">Prestatario:</span><span class="value">${client.name}${client.apodo ? ` (${client.apodo})` : ""}</span></div>
    ${client.cedula ? `<div class="row"><span class="label">Cédula:</span><span class="value">${decrypt(client.cedula)}</span></div>` : ""}
    ${client.phone ? `<div class="row"><span class="label">Teléfono:</span><span class="value">${decrypt(client.phone)}</span></div>` : ""}
    ${client.address ? `<div class="row"><span class="label">Dirección:</span><span class="value">${client.address}</span></div>` : ""}
  </div>

  <div class="section">
    <div class="section-title">Condiciones del Préstamo</div>
    <div class="highlight">
      <div class="row"><span class="label">Monto prestado:</span><span class="amount">RD$ ${Number(loan.amount).toLocaleString("es-DO")}</span></div>
    </div>
    <div class="row"><span class="label">Tasa de interés:</span><span class="value">${loan.interestRate}%</span></div>
    <div class="row"><span class="label">Total a pagar:</span><span class="value">RD$ ${Number(loan.totalAmount).toLocaleString("es-DO")}</span></div>
    <div class="row"><span class="label">Número de cuotas:</span><span class="value">${loan.installmentsCount} cuotas</span></div>
    <div class="row"><span class="label">Frecuencia de pago:</span><span class="value">${loan.frequency === "daily" ? "Diaria" : loan.frequency === "weekly" ? "Semanal" : "Quincenal"}</span></div>
    <div class="row"><span class="label">Fecha de inicio:</span><span class="value">${loan.startDate}</span></div>
    <div class="row"><span class="label">Monto por cuota:</span><span class="value">RD$ ${installments.length > 0 ? Number(installments[0].amount).toLocaleString("es-DO") : "—"}</span></div>
    ${totalPaid > 0 ? `<div class="row"><span class="label">Total pagado:</span><span class="value" style="color:#16a34a">RD$ ${totalPaid.toLocaleString("es-DO")}</span></div>` : ""}
    ${totalPending > 0 ? `<div class="row"><span class="label">Saldo pendiente:</span><span class="value" style="color:#dc2626">RD$ ${totalPending.toLocaleString("es-DO")}</span></div>` : ""}
  </div>

  <div class="section">
    <div class="section-title">Cláusulas y Condiciones</div>
    <p class="clause"><span>1.</span> El prestatario se compromete a pagar las cuotas según el calendario establecido, sin retrasos ni omisiones.</p>
    <p class="clause"><span>2.</span> En caso de mora, se aplicará un cargo adicional del 5% sobre el monto de la cuota vencida por cada semana de atraso.</p>
    <p class="clause"><span>3.</span> El prestatario autoriza al prestamista a contactarlo por los medios de comunicación disponibles (teléfono, WhatsApp) para gestiones de cobro.</p>
    <p class="clause"><span>4.</span> Este contrato es de carácter civil y se regirá por las leyes de la República Dominicana.</p>
    <p class="clause"><span>5.</span> El prestatario declara haber leído y comprendido todas las condiciones de este contrato y acepta su contenido voluntariamente.</p>
  </div>

  <div class="signature-section">
    <div class="row">
      <div style="width:45%">
        <div class="sig-box"></div>
        <div class="sig-label">Firma del Prestatario: ${client.name}</div>
      </div>
      <div style="width:45%">
        <div class="sig-box"></div>
        <div class="sig-label">Firma del Prestamista: ${businessName}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

router.get("/loan/:loanId", requireAuth, async (req, res) => {
  const loanId = Number(req.params.loanId);
  if (isNaN(loanId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const bizId = await getBusinessId(req);
  const whereClause = bizId !== null
    ? and(eq(loanContractsTable.loanId, loanId), eq(loanContractsTable.businessId, bizId))
    : eq(loanContractsTable.loanId, loanId);
  const [contract] = await db.select().from(loanContractsTable).where(whereClause).limit(1);
  res.json(contract ?? null);
});

router.post("/generate/:loanId", requireAuth, async (req, res) => {
  const loanId = Number(req.params.loanId);
  if (isNaN(loanId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const bizId = await getBusinessId(req);

  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, loanId)).limit(1);
  if (!loan) { res.status(404).json({ error: "Préstamo no encontrado" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, loan.clientId)).limit(1);
  if (!client) { res.status(404).json({ error: "Cliente no encontrado" }); return; }

  const installments = await db.select().from(installmentsTable).where(eq(installmentsTable.loanId, loanId));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session!.userId!)).limit(1);
  const businessName = user?.name ?? "The Necio Cobranza";

  const contractHtml = buildContractHtml(client, loan, installments, businessName);

  const existing = await db.select().from(loanContractsTable).where(eq(loanContractsTable.loanId, loanId)).limit(1);

  if (existing[0]) {
    const [updated] = await db.update(loanContractsTable)
      .set({ contractHtml, signatureBase64: null, signedAt: null })
      .where(eq(loanContractsTable.id, existing[0].id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(loanContractsTable).values({
      loanId,
      clientId: loan.clientId,
      businessId: bizId,
      contractHtml,
    }).returning();
    res.json(created);
  }
});

router.post("/:id/sign", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { signatureBase64, signerName } = req.body;
  if (!signatureBase64) { res.status(400).json({ error: "Firma requerida" }); return; }

  const signerIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";

  const [updated] = await db.update(loanContractsTable)
    .set({
      signatureBase64,
      signedAt: new Date(),
      signerName: signerName ?? null,
      signerIp,
    })
    .where(eq(loanContractsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Contrato no encontrado" }); return; }
  res.json(updated);
});

export default router;
