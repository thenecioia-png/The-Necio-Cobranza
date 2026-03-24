import { Router, type IRouter } from "express";
import { db, clientsTable, loansTable, installmentsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateClientBody, GetClientParams, UpdateClientBody, UpdateClientParams } from "@workspace/api-zod";

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
    phone: c.phone ?? undefined,
    whatsapp: c.whatsapp ?? undefined,
    address: c.address ?? undefined,
    sector: c.sector ?? undefined,
    ciudad: c.ciudad ?? undefined,
    cedula: c.cedula ?? undefined,
    status: c.status as "active" | "delinquent" | "uncollectible",
    riskScore: c.riskScore,
    notes: c.notes ?? undefined,
    fiadorName: c.fiadorName ?? undefined,
    fiadorPhone: c.fiadorPhone ?? undefined,
    cobradorId: c.cobradorId ?? undefined,
    cobrador: cobrador ?? undefined,
    avatarUrl: c.avatarUrl ?? undefined,
    gpsLat: c.gpsLat ?? undefined,
    gpsLng: c.gpsLng ?? undefined,
    createdAt: c.createdAt.toISOString(),
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
    phone: parsed.data.phone ?? null,
    whatsapp: parsed.data.whatsapp ?? null,
    address: parsed.data.address ?? null,
    sector: parsed.data.sector ?? null,
    ciudad: parsed.data.ciudad ?? null,
    cedula: parsed.data.cedula ?? null,
    notes: parsed.data.notes ?? null,
    fiadorName: parsed.data.fiadorName ?? null,
    fiadorPhone: parsed.data.fiadorPhone ?? null,
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

  const bodyParsed = UpdateClientBody.safeParse(req.body);
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
  const body = bodyParsed.data;
  if (body.status !== undefined) updates.status = body.status;
  if (body.riskScore !== undefined) updates.riskScore = body.riskScore;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.name !== undefined) updates.name = body.name;
  if (body.apodo !== undefined) updates.apodo = body.apodo;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.whatsapp !== undefined) updates.whatsapp = body.whatsapp;
  if (body.address !== undefined) updates.address = body.address;
  if (body.sector !== undefined) updates.sector = body.sector;
  if (body.ciudad !== undefined) updates.ciudad = body.ciudad;
  if (body.fiadorName !== undefined) updates.fiadorName = body.fiadorName;
  if (body.fiadorPhone !== undefined) updates.fiadorPhone = body.fiadorPhone;
  if (body.cobradorId !== undefined) updates.cobradorId = body.cobradorId ?? null;
  if ((body as any).avatarUrl !== undefined) updates.avatarUrl = (body as any).avatarUrl ?? null;

  const [updated] = await db
    .update(clientsTable)
    .set(updates)
    .where(eq(clientsTable.id, paramsParsed.data.id))
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
    .select({ client: clientsTable, cobrador: { id: usersTable.id, name: usersTable.name } })
    .from(clientsTable)
    .leftJoin(usersTable, eq(clientsTable.cobradorId, usersTable.id))
    .where(whereClause)
    .limit(1);
  const { client, cobrador } = rows[0] ?? {};
  if (!client) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const loans = await db.select().from(loansTable).where(eq(loansTable.clientId, client.id));

  const loansWithInstallments = await Promise.all(
    loans.map(async (loan) => {
      const installments = await db
        .select()
        .from(installmentsTable)
        .where(eq(installmentsTable.loanId, loan.id))
        .orderBy(installmentsTable.dueDate);

      return {
        id: loan.id,
        clientId: loan.clientId,
        amount: Number(loan.amount),
        interestRate: Number(loan.interestRate),
        installmentsCount: loan.installmentsCount,
        startDate: loan.startDate,
        frequency: loan.frequency,
        totalAmount: Number(loan.totalAmount),
        status: loan.status,
        createdAt: loan.createdAt.toISOString(),
        installments: installments.map(i => ({
          id: i.id,
          loanId: i.loanId,
          dueDate: i.dueDate,
          amount: Number(i.amount),
          status: i.status,
          paidAt: i.paidAt?.toISOString() ?? undefined,
          gpsLat: i.gpsLat ?? undefined,
          gpsLng: i.gpsLng ?? undefined,
          photoUrl: i.photoUrl ?? undefined,
        })),
      };
    })
  );

  res.json({
    ...mapClient(client, cobrador?.id ? cobrador : null),
    loans: loansWithInstallments,
  });
});

export default router;
