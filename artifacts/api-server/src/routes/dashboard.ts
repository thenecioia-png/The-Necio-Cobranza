import { Router, type IRouter } from "express";
import { db, clientsTable, loansTable, installmentsTable } from "@workspace/db";
import { eq, count, sum, ne, lt } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const [clientCount] = await db
    .select({ count: count() })
    .from(clientsTable);

  const [activeClientCount] = await db
    .select({ count: count() })
    .from(clientsTable)
    .where(eq(clientsTable.status, "active"));

  const [delinquentClientCount] = await db
    .select({ count: count() })
    .from(clientsTable)
    .where(eq(clientsTable.status, "delinquent"));

  const [activeLoanCount] = await db
    .select({ count: count() })
    .from(loansTable)
    .where(eq(loansTable.status, "active"));

  const todayInstallments = await db
    .select({ amount: installmentsTable.amount, status: installmentsTable.status })
    .from(installmentsTable)
    .where(eq(installmentsTable.dueDate, today));

  let todayCollected = 0;
  let todayPending = 0;
  let todayTotal = 0;
  for (const inst of todayInstallments) {
    const amt = Number(inst.amount);
    todayTotal += amt;
    if (inst.status === "paid") todayCollected += amt;
    else todayPending += amt;
  }

  const allLoans = await db
    .select({ amount: loansTable.amount, totalAmount: loansTable.totalAmount })
    .from(loansTable);

  const totalLent = allLoans.reduce((s, l) => s + Number(l.amount), 0);

  const paidInstallments = await db
    .select({ amount: installmentsTable.amount })
    .from(installmentsTable)
    .where(eq(installmentsTable.status, "paid"));

  const totalCollected = paidInstallments.reduce((s, i) => s + Number(i.amount), 0);

  const pendingInstallments = await db
    .select({ amount: installmentsTable.amount, status: installmentsTable.status, dueDate: installmentsTable.dueDate })
    .from(installmentsTable)
    .where(ne(installmentsTable.status, "paid"));

  const moneyOnStreet = pendingInstallments.reduce((s, i) => s + Number(i.amount), 0);

  const lateCount = pendingInstallments.filter(i => i.dueDate < today).length;
  const totalPendingCount = pendingInstallments.length;
  const delinquencyRate = totalPendingCount > 0 ? Math.round((lateCount / totalPendingCount) * 100) : 0;

  res.json({
    totalClients: clientCount.count,
    activeClients: activeClientCount.count,
    delinquentClients: delinquentClientCount.count,
    todayCollected,
    todayPending,
    todayTotal,
    activeLoans: activeLoanCount.count,
    totalLent,
    totalCollected,
    moneyOnStreet,
    delinquencyRate,
  });
});

export default router;
