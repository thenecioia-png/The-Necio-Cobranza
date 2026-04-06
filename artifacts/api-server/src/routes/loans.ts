import { Router, type IRouter } from "express";
import { db, loansTable, installmentsTable } from "@workspace/db";
import { CreateLoanBody } from "@workspace/api-zod";

const router: IRouter = Router();

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
  const parsed = CreateLoanBody.safeParse(req.body);
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

export default router;
