import { Router, type IRouter } from "express";
import { db, loansTable, installmentsTable, loanContractsTable, clientsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateLoanBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function getBusinessId(req: any): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.businessId ?? null;
}

function generateInstallments(loan: {
  id: number;
  clientId: number;
  amount: number;
  interestRate: number;
  installmentsCount: number;
  startDate: string;
  frequency: string;
  totalAmount: number;
}) {
  const perInstallment = loan.totalAmount / loan.installmentsCount;
  const installments = [];
  const startDate = new Date(loan.startDate);

  for (let i = 0; i < loan.installmentsCount; i++) {
    const dueDate = new Date(startDate);
    if (loan.frequency === "daily") {
      dueDate.setDate(startDate.getDate() + i);
    } else if (loan.frequency === "weekly") {
      dueDate.setDate(startDate.getDate() + i * 7);
    } else if (loan.frequency === "biweekly") {
      dueDate.setDate(startDate.getDate() + i * 14);
    } else if (loan.frequency === "monthly") {
      dueDate.setMonth(startDate.getMonth() + i);
    }

    installments.push({
      loanId: loan.id,
      clientId: loan.clientId,
      dueDate: dueDate.toISOString().split("T")[0],
      amount: perInstallment.toFixed(2),
      status: "pending" as const,
    });
  }
  return installments;
}

router.post("/", async (req, res) => {
  // Normalizar campos numéricos que vienen como strings desde x-www-form-urlencoded
  const body = req.body;
  if (body.clientId !== undefined) body.clientId = Number(body.clientId);
  if (body.amount !== undefined) body.amount = Number(body.amount);
  if (body.interestRate !== undefined) body.interestRate = Number(body.interestRate);
  if (body.installmentsCount !== undefined) body.installmentsCount = Number(body.installmentsCount);

  const parsed = CreateLoanBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const data = parsed.data;
  const totalAmount = data.amount + (data.amount * data.interestRate / 100);

  const [loan] = await db.insert(loansTable).values({
    clientId: data.clientId,
    amount: data.amount.toFixed(2),
    interestRate: data.interestRate.toFixed(2),
    installmentsCount: data.installmentsCount,
    startDate: data.startDate,
    frequency: data.frequency,
    totalAmount: totalAmount.toFixed(2),
    status: "active",
  }).returning();

  const installmentValues = generateInstallments({
    id: loan.id,
    clientId: data.clientId,
    amount: data.amount,
    interestRate: data.interestRate,
    installmentsCount: data.installmentsCount,
    startDate: data.startDate,
    frequency: data.frequency,
    totalAmount,
  });

  await db.insert(installmentsTable).values(installmentValues);

  res.status(201).json({
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
  });
});

router.delete("/:id", async (req, res) => {
  const loanId = Number(req.params.id);
  if (isNaN(loanId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, loanId)).limit(1);
  if (!loan) {
    res.status(404).json({ error: "Préstamo no encontrado" });
    return;
  }

  const bizId = await getBusinessId(req);
  if (bizId !== null) {
    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, loan.clientId), eq(clientsTable.businessId, bizId)))
      .limit(1);
    if (!client) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
  }

  await db.delete(loanContractsTable).where(eq(loanContractsTable.loanId, loanId));
  await db.delete(installmentsTable).where(eq(installmentsTable.loanId, loanId));
  await db.delete(loansTable).where(eq(loansTable.id, loanId));

  res.json({ message: "Préstamo eliminado" });
});

export default router;
