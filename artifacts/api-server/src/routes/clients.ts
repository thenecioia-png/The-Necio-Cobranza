import { Router, type IRouter } from "express";
import { db, clientsTable, loansTable, installmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateClientBody, GetClientParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const clients = await db.select().from(clientsTable).orderBy(clientsTable.createdAt);
  res.json(clients.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? undefined,
    address: c.address ?? undefined,
    cedula: c.cedula ?? undefined,
    createdAt: c.createdAt.toISOString(),
  })));
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
  }).returning();

  res.status(201).json({
    id: client.id,
    name: client.name,
    phone: client.phone ?? undefined,
    address: client.address ?? undefined,
    cedula: client.cedula ?? undefined,
    createdAt: client.createdAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const parsed = GetClientParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const clients = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, parsed.data.id))
    .limit(1);

  const client = clients[0];
  if (!client) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const loans = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.clientId, client.id));

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
    id: client.id,
    name: client.name,
    phone: client.phone ?? undefined,
    address: client.address ?? undefined,
    cedula: client.cedula ?? undefined,
    createdAt: client.createdAt.toISOString(),
    loans: loansWithInstallments,
  });
});

export default router;
