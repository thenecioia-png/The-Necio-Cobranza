import { Router, type IRouter } from "express";
import { db, installmentsTable, loansTable, clientsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, ne } from "drizzle-orm";
import { PayInstallmentParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/today", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const userId = (req.session as any)?.userId as number | undefined;

  let cobradorFilter: number | null = null;
  let businessIdFilter: number | null = null;

  if (userId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (user?.role === "cobrador") cobradorFilter = user.id;
    if (user?.businessId) businessIdFilter = user.businessId;
  }

  let whereClause: any;
  if (cobradorFilter !== null) {
    whereClause = and(eq(installmentsTable.dueDate, today), eq(clientsTable.cobradorId, cobradorFilter));
  } else if (businessIdFilter !== null) {
    whereClause = and(eq(installmentsTable.dueDate, today), eq(clientsTable.businessId, businessIdFilter));
  } else {
    whereClause = eq(installmentsTable.dueDate, today);
  }

  const rows = await db
    .select({
      id: installmentsTable.id,
      loanId: installmentsTable.loanId,
      dueDate: installmentsTable.dueDate,
      amount: installmentsTable.amount,
      status: installmentsTable.status,
      paidAt: installmentsTable.paidAt,
      paymentMethod: installmentsTable.paymentMethod,
      gpsLat: installmentsTable.gpsLat,
      gpsLng: installmentsTable.gpsLng,
      photoUrl: installmentsTable.photoUrl,
      clientName: clientsTable.name,
      clientPhone: clientsTable.phone,
      clientId: clientsTable.id,
      clientAddress: clientsTable.address,
      clientSector: clientsTable.sector,
      clientCiudad: clientsTable.ciudad,
      clientAvatarUrl: clientsTable.avatarUrl,
      loanFrequency: loansTable.frequency,
    })
    .from(installmentsTable)
    .innerJoin(loansTable, eq(installmentsTable.loanId, loansTable.id))
    .innerJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
    .where(whereClause)
    .orderBy(installmentsTable.status);

  res.json(rows.map(r => ({
    id: r.id,
    loanId: r.loanId,
    dueDate: r.dueDate,
    amount: Number(r.amount),
    status: r.status,
    paymentMethod: r.paymentMethod ?? "efectivo",
    paidAt: r.paidAt?.toISOString() ?? undefined,
    gpsLat: r.gpsLat ?? undefined,
    gpsLng: r.gpsLng ?? undefined,
    photoUrl: r.photoUrl ?? undefined,
    clientName: r.clientName,
    clientPhone: r.clientPhone ?? undefined,
    clientId: r.clientId,
    clientAddress: r.clientAddress ?? undefined,
    clientSector: r.clientSector ?? undefined,
    clientCiudad: r.clientCiudad ?? undefined,
    clientAvatarUrl: r.clientAvatarUrl ?? undefined,
    loanFrequency: r.loanFrequency,
  })));
});

// Pay single installment
router.post("/:id/pay", async (req, res) => {
  const parsed = PayInstallmentParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const installments = await db
    .select()
    .from(installmentsTable)
    .where(eq(installmentsTable.id, parsed.data.id))
    .limit(1);

  const installment = installments[0];
  if (!installment) {
    res.status(404).json({ error: "Cuota no encontrada" });
    return;
  }

  const paymentMethod = ["efectivo", "transferencia", "otro"].includes(req.body?.paymentMethod)
    ? req.body.paymentMethod
    : "efectivo";

  const gpsLat = typeof req.body?.gpsLat === "number" ? req.body.gpsLat : null;
  const gpsLng = typeof req.body?.gpsLng === "number" ? req.body.gpsLng : null;
  const photoUrl = typeof req.body?.photoUrl === "string" ? req.body.photoUrl : null;

  const userId = (req.session as any)?.userId as number | undefined;

  const [updated] = await db
    .update(installmentsTable)
    .set({
      status: "paid",
      paidAt: new Date(),
      paymentMethod,
      gpsLat,
      gpsLng,
      photoUrl,
      cobradorId: userId ?? null,
    })
    .where(eq(installmentsTable.id, parsed.data.id))
    .returning();

  // Send WhatsApp confirmation asynchronously (fire & forget)
  const twilioClient = (req as any).twilioClient;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
  if (twilioClient && fromNumber) {
    db.select({
      clientName: clientsTable.name,
      clientPhone: clientsTable.phone,
      clientWhatsapp: clientsTable.whatsapp,
    })
    .from(loansTable)
    .innerJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
    .where(eq(loansTable.id, updated.loanId))
    .limit(1)
    .then(([client]) => {
      const phone = client?.clientWhatsapp || client?.clientPhone;
      if (!phone || !client) return;
      const cleaned = phone.replace(/\D/g, "");
      const e164 = cleaned.length === 10 ? `+1${cleaned}` : cleaned.length === 11 && cleaned.startsWith("1") ? `+${cleaned}` : `+${cleaned}`;
      const amount = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(updated.amount);
      const msg = `✅ *Pago Confirmado*\n\nHola ${client.clientName},\n\nRegistramos tu pago de *${amount}* para la cuota del ${new Date(updated.dueDate).toLocaleDateString("es-DO")}.\n\n¡Gracias! 🙌\n\n_The Necio Cobranza_`;
      const from = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;
      twilioClient.messages.create({ from, to: `whatsapp:${e164}`, body: msg }).catch(() => {});
    }).catch(() => {});
  }

  res.json({
    id: updated.id,
    loanId: updated.loanId,
    dueDate: updated.dueDate,
    amount: Number(updated.amount),
    status: updated.status,
    paymentMethod: updated.paymentMethod ?? "efectivo",
    paidAt: updated.paidAt?.toISOString() ?? undefined,
    gpsLat: updated.gpsLat ?? undefined,
    gpsLng: updated.gpsLng ?? undefined,
    photoUrl: updated.photoUrl ?? undefined,
  });
});

// Pay multiple installments at once
router.post("/pay-bulk", async (req, res) => {
  const { installmentIds } = req.body;
  if (!Array.isArray(installmentIds) || installmentIds.length === 0 || !installmentIds.every(id => typeof id === "number")) {
    res.status(400).json({ error: "IDs inválidos" });
    return;
  }

  const updated = await db
    .update(installmentsTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(
      and(
        inArray(installmentsTable.id, installmentIds),
        ne(installmentsTable.status, "paid")
      )
    )
    .returning();

  res.json({
    paid: updated.length,
    totalAmount: updated.reduce((s, i) => s + Number(i.amount), 0),
    installments: updated.map(i => ({
      id: i.id,
      loanId: i.loanId,
      dueDate: i.dueDate,
      amount: Number(i.amount),
      status: i.status,
      paidAt: i.paidAt?.toISOString() ?? undefined,
    })),
  });
});

// Abono: apply a custom amount to the oldest pending installments of a client
router.post("/abono/:clientId", async (req, res) => {
  const clientId = Number(req.params.clientId);
  const amount = Number(req.body?.amount);

  if (isNaN(clientId) || isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  let remaining = amount;

  const pendingInstallments = await db
    .select({
      id: installmentsTable.id,
      amount: installmentsTable.amount,
      dueDate: installmentsTable.dueDate,
      status: installmentsTable.status,
    })
    .from(installmentsTable)
    .innerJoin(loansTable, eq(installmentsTable.loanId, loansTable.id))
    .where(
      and(
        eq(loansTable.clientId, clientId),
        ne(installmentsTable.status, "paid")
      )
    )
    .orderBy(installmentsTable.dueDate);

  if (pendingInstallments.length === 0) {
    res.status(400).json({ error: "Este cliente no tiene cuotas pendientes" });
    return;
  }

  const paidIds: number[] = [];

  for (const inst of pendingInstallments) {
    const instAmount = Number(inst.amount);
    if (remaining >= instAmount) {
      paidIds.push(inst.id);
      remaining -= instAmount;
    } else {
      break;
    }
  }

  let paidCount = 0;
  if (paidIds.length > 0) {
    const updated = await db
      .update(installmentsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(inArray(installmentsTable.id, paidIds))
      .returning();
    paidCount = updated.length;
  }

  const amountApplied = amount - remaining;

  res.json({
    paid: paidCount,
    amountApplied,
    amountRemaining: Math.round(remaining * 100) / 100,
    totalPending: pendingInstallments.length,
  });
});

export default router;
