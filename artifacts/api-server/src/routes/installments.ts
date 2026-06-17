import { Router, type IRouter } from "express";
import { db, installmentsTable, loansTable, clientsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, ne } from "drizzle-orm";
import { PayInstallmentParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getBusinessId(req: any): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.businessId ?? null;
}

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
      paidAmount: installmentsTable.paidAmount,
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
    paidAmount: Number(r.paidAmount ?? 0),
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

  const bizId = await getBusinessId(req);
  if (bizId !== null) {
    const [owner] = await db
      .select({ id: clientsTable.id })
      .from(installmentsTable)
      .innerJoin(loansTable, eq(installmentsTable.loanId, loansTable.id))
      .innerJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
      .where(and(
        eq(installmentsTable.id, parsed.data.id),
        eq(clientsTable.businessId, bizId),
      ))
      .limit(1);
    if (!owner) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
  }

  if (installment.status === "paid") {
    res.status(409).json({ error: "Esta cuota ya fue pagada" });
    return;
  }

  const paymentMethod = ["efectivo", "transferencia", "otro"].includes(req.body?.paymentMethod)
    ? req.body.paymentMethod
    : "efectivo";

  const gpsLat = req.body?.gpsLat ? Number(req.body.gpsLat) : null;
  const gpsLng = req.body?.gpsLng ? Number(req.body.gpsLng) : null;
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
      const amount = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(updated.amount));
      const msg = `✅ *Pago Confirmado*\n\nHola ${client.clientName},\n\nRegistramos tu pago de *${amount}* para la cuota del ${new Date(updated.dueDate).toLocaleDateString("es-DO")}.\n\n¡Gracias! 🙌\n\n_The Necio Cobranza_`;
      const from = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;
      twilioClient.messages.create({ from, to: `whatsapp:${e164}`, body: msg })
        .then((msgRes: any) => {
          logger.info({ sid: msgRes.sid, to: e164 }, "WhatsApp enviado");
        })
        .catch((twilioErr: any) => {
          logger.warn({ err: twilioErr.message, to: e164 }, "WhatsApp fallo");
        });
    }).catch((dbErr: any) => {
      logger.warn({ err: dbErr.message }, "Error buscando cliente para WhatsApp");
    });
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
  if (!Array.isArray(installmentIds) || installmentIds.length === 0) {
    res.status(400).json({ error: "IDs inválidos" });
    return;
  }

  const userId = (req.session as any)?.userId as number | undefined;
  let businessIdFilter: number | null = null;

  if (userId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (user?.businessId) businessIdFilter = user.businessId;
  }

  let whereClause;
  if (businessIdFilter !== null) {
    // Verify installments belong to clients of this business
    const validIds = await db
      .select({ id: installmentsTable.id })
      .from(installmentsTable)
      .innerJoin(loansTable, eq(installmentsTable.loanId, loansTable.id))
      .innerJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
      .where(
        and(
          inArray(installmentsTable.id, installmentIds),
          eq(clientsTable.businessId, businessIdFilter),
          ne(installmentsTable.status, "paid")
        )
      );
    const allowedIds = validIds.map(r => r.id);
    if (allowedIds.length === 0) {
      res.status(403).json({ error: "No tienes permiso para cobrar estas cuotas" });
      return;
    }
    whereClause = and(inArray(installmentsTable.id, allowedIds), ne(installmentsTable.status, "paid"));
  } else {
    whereClause = and(inArray(installmentsTable.id, installmentIds), ne(installmentsTable.status, "paid"));
  }

  const updated = await db
    .update(installmentsTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(whereClause)
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

  const bizId = await getBusinessId(req);
  if (bizId !== null) {
    const [client] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.businessId, bizId)))
      .limit(1);
    if (!client) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
  }

  let remaining = amount;

  const pendingInstallments = await db
    .select({
      id: installmentsTable.id,
      amount: installmentsTable.amount,
      paidAmount: installmentsTable.paidAmount,
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
  let partialInstId: number | null = null;
  let newPaidAmount = 0;

  for (const inst of pendingInstallments) {
    const totalAmount = Number(inst.amount);
    const alreadyPaid = Number(inst.paidAmount ?? 0);
    const instDue = totalAmount - alreadyPaid;

    if (remaining >= instDue) {
      paidIds.push(inst.id);
      remaining -= instDue;
    } else if (remaining > 0) {
      partialInstId = inst.id;
      newPaidAmount = alreadyPaid + remaining;
      remaining = 0;
      break;
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

  if (partialInstId !== null) {
    await db
      .update(installmentsTable)
      .set({ paidAmount: String(Math.round(newPaidAmount * 100) / 100) })
      .where(eq(installmentsTable.id, partialInstId));
  }

  const amountApplied = amount - remaining;

  res.json({
    paid: paidCount,
    amountApplied,
    amountRemaining: Math.round(remaining * 100) / 100,
    totalPending: pendingInstallments.length,
  });
});

// Abono applied to a specific loan (not all client loans)
router.post("/abono-loan/:loanId", async (req, res) => {
  const loanId = Number(req.params.loanId);
  const amount = Number(req.body?.amount);
  const paymentMethod = ["efectivo", "transferencia", "otro"].includes(req.body?.paymentMethod)
    ? req.body.paymentMethod : "efectivo";
  const gpsLat = req.body?.gpsLat ? Number(req.body.gpsLat) : null;
  const gpsLng = req.body?.gpsLng ? Number(req.body.gpsLng) : null;
  const photoUrl = typeof req.body?.photoUrl === "string" ? req.body.photoUrl : null;
  const userId = (req.session as any)?.userId as number | undefined;

  if (isNaN(loanId) || isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const bizId = await getBusinessId(req);
  if (bizId !== null) {
    const [owner] = await db
      .select({ id: clientsTable.id })
      .from(loansTable)
      .innerJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
      .where(and(eq(loansTable.id, loanId), eq(clientsTable.businessId, bizId)))
      .limit(1);
    if (!owner) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
  }

  const pendingInstallments = await db
    .select({ id: installmentsTable.id, amount: installmentsTable.amount, paidAmount: installmentsTable.paidAmount, dueDate: installmentsTable.dueDate })
    .from(installmentsTable)
    .where(and(eq(installmentsTable.loanId, loanId), ne(installmentsTable.status, "paid")))
    .orderBy(installmentsTable.dueDate);

  if (pendingInstallments.length === 0) {
    res.status(400).json({ error: "Este préstamo no tiene cuotas pendientes" });
    return;
  }

  let remaining = amount;
  const paidIds: number[] = [];
  let partialInstId: number | null = null;
  let newPaidAmount = 0;

  for (const inst of pendingInstallments) {
    const totalAmount = Number(inst.amount);
    const alreadyPaid = Number(inst.paidAmount ?? 0);
    const instDue = totalAmount - alreadyPaid;

    if (remaining >= instDue) {
      paidIds.push(inst.id);
      remaining -= instDue;
    } else if (remaining > 0) {
      partialInstId = inst.id;
      newPaidAmount = alreadyPaid + remaining;
      remaining = 0;
      break;
    } else {
      break;
    }
  }

  let paidCount = 0;
  if (paidIds.length > 0) {
    const updated = await db
      .update(installmentsTable)
      .set({ status: "paid", paidAt: new Date(), paymentMethod, gpsLat, gpsLng, photoUrl, cobradorId: userId ?? null })
      .where(inArray(installmentsTable.id, paidIds))
      .returning();
    paidCount = updated.length;
  }

  if (partialInstId !== null) {
    await db
      .update(installmentsTable)
      .set({ paidAmount: String(Math.round(newPaidAmount * 100) / 100) })
      .where(eq(installmentsTable.id, partialInstId));
  }

  // Check if loan is now fully paid
  const remaining2 = await db
    .select({ id: installmentsTable.id })
    .from(installmentsTable)
    .where(and(eq(installmentsTable.loanId, loanId), ne(installmentsTable.status, "paid")))
    .limit(1);

  if (remaining2.length === 0) {
    await db.update(loansTable).set({ status: "completed" }).where(eq(loansTable.id, loanId));
  }

  res.json({
    paid: paidCount,
    amountApplied: amount - remaining,
    amountRemaining: Math.round(remaining * 100) / 100,
    totalPending: pendingInstallments.length,
    loanCompleted: remaining2.length === 0,
  });
});

// Liquidar: pay all remaining installments of a loan
router.post("/loan/:loanId/liquidar", async (req, res) => {
  const loanId = Number(req.params.loanId);
  const paymentMethod = ["efectivo", "transferencia", "otro"].includes(req.body?.paymentMethod)
    ? req.body.paymentMethod : "efectivo";
  const gpsLat = req.body?.gpsLat ? Number(req.body.gpsLat) : null;
  const gpsLng = req.body?.gpsLng ? Number(req.body.gpsLng) : null;
  const photoUrl = typeof req.body?.photoUrl === "string" ? req.body.photoUrl : null;
  const userId = (req.session as any)?.userId as number | undefined;

  if (isNaN(loanId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const bizId = await getBusinessId(req);
  if (bizId !== null) {
    const [owner] = await db
      .select({ id: clientsTable.id })
      .from(loansTable)
      .innerJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
      .where(and(eq(loansTable.id, loanId), eq(clientsTable.businessId, bizId)))
      .limit(1);
    if (!owner) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
  }

  const pending = await db
    .select({ id: installmentsTable.id, amount: installmentsTable.amount })
    .from(installmentsTable)
    .where(and(eq(installmentsTable.loanId, loanId), ne(installmentsTable.status, "paid")));

  if (pending.length === 0) {
    res.status(400).json({ error: "Este préstamo ya está liquidado" });
    return;
  }

  const ids = pending.map(i => i.id);
  const totalAmount = pending.reduce((s, i) => s + Number(i.amount), 0);

  await db
    .update(installmentsTable)
    .set({ status: "paid", paidAt: new Date(), paymentMethod, gpsLat, gpsLng, photoUrl, cobradorId: userId ?? null })
    .where(inArray(installmentsTable.id, ids));

  await db.update(loansTable).set({ status: "completed" }).where(eq(loansTable.id, loanId));

  res.json({ paid: ids.length, totalAmount });
});

export default router;
