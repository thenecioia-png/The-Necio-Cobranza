import { Router, type IRouter } from "express";
import { db, clientsTable, loansTable, installmentsTable, loanContractsTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { CreateClientBody, GetClientParams, UpdateClientBody, UpdateClientParams } from "@workspace/api-zod";
import { decrypt, encrypt, isEncryptionEnabled } from "../lib/encryption";
import { verifyConfirmationCode } from "./confirmations";

const router: IRouter = Router();

async function getBusinessId(req: any): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.businessId ?? null;
}

function mapClient(c: typeof clientsTable.$inferSelect, cobrador?: { id: number; name: string } | null) {
  return {
    id: c.id,
    name: c.name,
    apodo: c.apodo ?? undefined,
    phone: decrypt(c.phone) ?? undefined,
    whatsapp: decrypt(c.whatsapp) ?? undefined,
    address: c.address ?? undefined,
    sector: c.sector ?? undefined,
    ciudad: c.ciudad ?? undefined,
    cedula: decrypt(c.cedula) ?? undefined,
    status: c.status as "active" | "delinquent" | "uncollectible",
    riskScore: c.riskScore,
    notes: c.notes ?? undefined,
    fiadorName: c.fiadorName ?? undefined,
    fiadorPhone: decrypt(c.fiadorPhone) ?? undefined,
    cobradorId: c.cobradorId ?? undefined,
    cobrador: cobrador ?? undefined,
    avatarUrl: c.avatarUrl ?? undefined,
    gpsLat: c.gpsLat ?? undefined,
    gpsLng: c.gpsLng ?? undefined,
    createdAt: c.createdAt.toISOString(),
    encryptionEnabled: isEncryptionEnabled(),
  };
}

router.get("/", async (req, res) => {
  const bizId = await getBusinessId(req);
  const whereClause = bizId !== null ? eq(clientsTable.businessId, bizId) : undefined;

  const rows = await db
    .select({
      client: clientsTable,
      cobrador: { id: usersTable.id, name: usersTable.name },
    })
    .from(clientsTable)
    .leftJoin(usersTable, eq(clientsTable.cobradorId, usersTable.id))
    .where(whereClause)
    .orderBy(clientsTable.createdAt);
  res.json(rows.map(r => mapClient(r.client, r.cobrador?.id ? r.cobrador : null)));
});

router.post("/", async (req, res) => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const bizId = await getBusinessId(req);

  const [client] = await db.insert(clientsTable).values({
    name: parsed.data.name,
    apodo: parsed.data.apodo ?? null,
    phone: (encrypt(parsed.data.phone) ?? parsed.data.phone) ?? null,
    whatsapp: (encrypt(parsed.data.whatsapp) ?? parsed.data.whatsapp) ?? null,
    address: parsed.data.address ?? null,
    sector: parsed.data.sector ?? null,
    ciudad: parsed.data.ciudad ?? null,
    cedula: (encrypt(parsed.data.cedula) ?? parsed.data.cedula) ?? null,
    notes: parsed.data.notes ?? null,
    fiadorName: parsed.data.fiadorName ?? null,
    fiadorPhone: (encrypt(parsed.data.fiadorPhone) ?? parsed.data.fiadorPhone) ?? null,
    status: "active",
    riskScore: 50,
    businessId: bizId,
  }).returning();

  res.status(201).json(mapClient(client));
});

router.patch("/:id", async (req, res) => {
  const paramsParsed = UpdateClientParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const body = req.body;
  if (body.riskScore !== undefined) body.riskScore = Number(body.riskScore);
  if (body.cobradorId !== undefined) body.cobradorId = body.cobradorId === "" ? null : Number(body.cobradorId);
  const bodyParsed = UpdateClientBody.safeParse(body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const bizId = await getBusinessId(req);
  const whereClause = bizId !== null
    ? and(eq(clientsTable.id, paramsParsed.data.id), eq(clientsTable.businessId, bizId))
    : eq(clientsTable.id, paramsParsed.data.id);

  const existing = await db.select().from(clientsTable).where(whereClause).limit(1);
  if (!existing[0]) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const data = bodyParsed.data;
  if (data.status !== undefined) updates.status = data.status;
  if (data.riskScore !== undefined) updates.riskScore = data.riskScore;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.name !== undefined) updates.name = data.name;
  if (data.apodo !== undefined) updates.apodo = data.apodo;
  if (data.phone !== undefined) updates.phone = encrypt(data.phone) ?? data.phone;
  if (data.whatsapp !== undefined) updates.whatsapp = encrypt(data.whatsapp) ?? data.whatsapp;
  if (data.address !== undefined) updates.address = data.address;
  if (data.sector !== undefined) updates.sector = data.sector;
  if (data.ciudad !== undefined) updates.ciudad = data.ciudad;
  if (data.fiadorName !== undefined) updates.fiadorName = data.fiadorName;
  if (data.fiadorPhone !== undefined) updates.fiadorPhone = encrypt(data.fiadorPhone) ?? data.fiadorPhone;
  if (data.cobradorId !== undefined) updates.cobradorId = data.cobradorId ?? null;
  if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl ?? null;
  if ((data as any).cedula !== undefined) updates.cedula = encrypt((data as any).cedula) ?? (data as any).cedula;

  if (Object.keys(updates).length === 0) {
    res.json(mapClient(existing[0]));
    return;
  }

  const [updated] = await db
    .update(clientsTable)
    .set(updates)
    .where(whereClause)
    .returning();

  res.json(mapClient(updated));
});

router.get("/:id", async (req, res) => {
  const parsed = GetClientParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const bizId = await getBusinessId(req);
  const whereClause = bizId !== null
    ? and(eq(clientsTable.id, parsed.data.id), eq(clientsTable.businessId, bizId))
    : eq(clientsTable.id, parsed.data.id);

  const rows = await db
    .select({
      client: clientsTable,
      cobrador: { id: usersTable.id, name: usersTable.name },
    })
    .from(clientsTable)
    .leftJoin(usersTable, eq(clientsTable.cobradorId, usersTable.id))
    .where(whereClause)
    .limit(1);

  if (!rows[0]) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const r = rows[0];

  // Fetch loans + installments for this client
  const loans = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.clientId, parsed.data.id))
    .orderBy(loansTable.createdAt);

  const installments = loans.length > 0
    ? await db
        .select()
        .from(installmentsTable)
        .where(
          loans.length === 1
            ? eq(installmentsTable.loanId, loans[0].id)
            : inArray(installmentsTable.loanId, loans.map(l => l.id))
        )
        .orderBy(installmentsTable.dueDate)
    : [];

  const loansWithInstallments = loans.map(loan => ({
    id: loan.id,
    clientId: loan.clientId,
    amount: Number(loan.amount),
    interestRate: Number(loan.interestRate),
    installmentsCount: loan.installmentsCount,
    startDate: loan.startDate,
    frequency: loan.frequency,
    totalAmount: Number(loan.totalAmount),
    status: loan.status,
    createdAt: loan.createdAt,
    installments: installments
      .filter(i => i.loanId === loan.id)
      .map(i => ({
        id: i.id,
        loanId: i.loanId,
        amount: Number(i.amount),
        dueDate: i.dueDate,
        status: i.status,
        paidAt: i.paidAt,
        paymentMethod: i.paymentMethod,
        paidAmount: Number(i.paidAmount ?? 0),
      })),
  }));

  res.json({
    ...mapClient(r.client, r.cobrador?.id ? r.cobrador : null),
    loans: loansWithInstallments,
  });
});

router.delete("/:id", async (req, res) => {
  const { code } = req.body;
  const clientId = Number(req.params.id);
  if (!code || !verifyConfirmationCode("delete-client", clientId, code)) {
    res.status(400).json({ error: "Código de confirmación inválido o expirado" });
    return;
  }

  const parsed = GetClientParams.safeParse({ id: clientId });
  if (!parsed.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const bizId = await getBusinessId(req);
  const whereClause = bizId !== null
    ? and(eq(clientsTable.id, parsed.data.id), eq(clientsTable.businessId, bizId))
    : eq(clientsTable.id, parsed.data.id);

  const existing = await db.select().from(clientsTable).where(whereClause).limit(1);
  if (!existing[0]) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  // Get all loans for this client
  const loans = await db.select().from(loansTable).where(eq(loansTable.clientId, parsed.data.id));
  const loanIds = loans.map(l => l.id);

  // Delete related records in order: contracts -> installments -> loans -> client
  if (loanIds.length > 0) {
    await db.delete(loanContractsTable).where(
      loanIds.length === 1
        ? eq(loanContractsTable.loanId, loanIds[0])
        : inArray(loanContractsTable.loanId, loanIds)
    );
    await db.delete(installmentsTable).where(
      loanIds.length === 1
        ? eq(installmentsTable.loanId, loanIds[0])
        : inArray(installmentsTable.loanId, loanIds)
    );
    await db.delete(loansTable).where(
      loanIds.length === 1
        ? eq(loansTable.id, loanIds[0])
        : inArray(loansTable.id, loanIds)
    );
  }
  // Also delete any contracts directly linked to client (fallback)
  await db.delete(loanContractsTable).where(eq(loanContractsTable.clientId, parsed.data.id));

  await db.delete(clientsTable).where(whereClause);

  res.json({ message: "Cliente eliminado" });
});

export default router;
