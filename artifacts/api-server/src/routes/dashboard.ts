import { Router, type IRouter } from "express";
import { db, clientsTable, loansTable, installmentsTable } from "@workspace/db";
import { eq, count, sum } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const [clientCount] = await db
    .select({ count: count() })
    .from(clientsTable);

  const [activeLoanCount] = await db
    .select({ count: count() })
    .from(loansTable)
    .where(eq(loansTable.status, "active"));

  const [collectedResult] = await db
    .select({ total: sum(installmentsTable.amount) })
    .from(installmentsTable)
    .where(eq(installmentsTable.dueDate, today));

  const [paidResult] = await db
    .select({ total: sum(installmentsTable.amount) })
    .from(installmentsTable)
    .where(eq(installmentsTable.status, "paid"));

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
    if (inst.status === "paid") {
      todayCollected += amt;
    } else {
      todayPending += amt;
    }
  }

  res.json({
    totalClients: clientCount.count,
    todayCollected,
    todayPending,
    todayTotal,
    activeLoans: activeLoanCount.count,
  });
});

export default router;
