import { Router, type IRouter } from "express";
import { db, clientsTable, loansTable, installmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateClientBody, GetClientParams, UpdateClientBody, UpdateClientParams } from "@workspace/api-zod";

const router: IRouter = Router();

function mapClient(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? undefined,
    address: c.address ?? undefined,
    cedula: c.cedula ?? undefined,
    status: c.status as "active" | "delinquent" | "uncollectible",
    riskScore: c.riskScore,
    notes: c.notes ?? undefined,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const clients = await db.select().from(clientsTable).orderBy(clientsTable.createdAt);
  res.json(clients.map(mapClient));
});

router.post("/", async (req, res) => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const [client] = await db.insert(clientsTable).values({
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
    address: parsed.data.address ?? null,
    cedula: parsed.data.cedula ?? null,
    notes: parsed.data.notes ?? null,
    status: "active",
    riskScore: 50,
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

  const existing = await db.select().from(clientsTable).where(eq(clientsTable.id, paramsParsed.data.id)).limit(1);
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
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.address !== undefined) updates.address = body.address;

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

  const clients = await db.select().from(clientsTable).where(eq(clientsTable.id, parsed.data.id)).limit(1);
  const client = clients[0];
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
        })),
      };
    })
  );

  res.json({
    ...mapClient(client),
    loans: loansWithInstallments,
  });
});

export default router;
