import { Router, type IRouter } from "express";
import { db, clientsTable, loansTable, installmentsTable, usersTable } from "@workspace/db";
import { eq, count, ne, and, inArray, sql } from "drizzle-orm";

const router: IRouter = Router();

async function getBusinessId(req: any): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.businessId ?? null;
}

/** Devuelve IDs de clientes del negocio, o null si no hay filtro por negocio */
async function getClientIds(bizId: number | null): Promise<number[] | null> {
  if (bizId === null) return null;
  const rows = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.businessId, bizId));
  return rows.map(r => r.id);
}

/** Devuelve IDs de préstamos dado un conjunto de clientIds */
async function getLoanIds(clientIds: number[]): Promise<number[]> {
  if (clientIds.length === 0) return [];
  const rows = await db.select({ id: loansTable.id }).from(loansTable).where(inArray(loansTable.clientId, clientIds));
  return rows.map(r => r.id);
}

router.get("/stats", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const bizId = await getBusinessId(req);
  const bizFilter = bizId !== null ? eq(clientsTable.businessId, bizId) : undefined;

  const [clientCount] = await db.select({ count: count() }).from(clientsTable).where(bizFilter);
  const [activeClientCount] = await db.select({ count: count() }).from(clientsTable)
    .where(bizFilter ? and(bizFilter, eq(clientsTable.status, "active")) : eq(clientsTable.status, "active"));
  const [delinquentClientCount] = await db.select({ count: count() }).from(clientsTable)
    .where(bizFilter ? and(bizFilter, eq(clientsTable.status, "delinquent")) : eq(clientsTable.status, "delinquent"));

  const clientIds = await getClientIds(bizId);
  const loanIds = clientIds !== null ? await getLoanIds(clientIds) : null;

  let activeLoanCount = 0;
  let totalLent = 0;
  let totalCollected = 0;
  let moneyOnStreet = 0;
  let todayCollected = 0;
  let todayPending = 0;
  let todayTotal = 0;
  let delinquencyRate = 0;

  if (loanIds === null || loanIds.length > 0) {
    const loanWhere = loanIds !== null
      ? and(eq(loansTable.status, "active"), inArray(loansTable.id, loanIds))
      : eq(loansTable.status, "active");

    const [activeLoanRow] = await db.select({ count: count() }).from(loansTable).where(loanWhere);
    activeLoanCount = Number(activeLoanRow.count);

    const allLoans = await db.select({ amount: loansTable.amount }).from(loansTable)
      .where(loanIds !== null ? inArray(loansTable.id, loanIds) : undefined);
    totalLent = allLoans.reduce((s, l) => s + Number(l.amount), 0);

    const instWhere = loanIds !== null ? inArray(installmentsTable.loanId, loanIds) : undefined;

    const todayInsts = await db
      .select({ amount: installmentsTable.amount, status: installmentsTable.status })
      .from(installmentsTable)
      .where(instWhere ? and(eq(installmentsTable.dueDate, today), instWhere) : eq(installmentsTable.dueDate, today));

    for (const inst of todayInsts) {
      const amt = Number(inst.amount);
      todayTotal += amt;
      if (inst.status === "paid") todayCollected += amt;
      else todayPending += amt;
    }

    const paidInsts = await db.select({ amount: installmentsTable.amount }).from(installmentsTable)
      .where(instWhere ? and(eq(installmentsTable.status, "paid"), instWhere) : eq(installmentsTable.status, "paid"));
    totalCollected = paidInsts.reduce((s, i) => s + Number(i.amount), 0);

    const pendingInsts = await db
      .select({ amount: installmentsTable.amount, dueDate: installmentsTable.dueDate })
      .from(installmentsTable)
      .where(instWhere ? and(ne(installmentsTable.status, "paid"), instWhere) : ne(installmentsTable.status, "paid"));
    moneyOnStreet = pendingInsts.reduce((s, i) => s + Number(i.amount), 0);

    const lateCount = pendingInsts.filter(i => i.dueDate < today).length;
    delinquencyRate = pendingInsts.length > 0 ? Math.round((lateCount / pendingInsts.length) * 100) : 0;
  }

  res.json({
    totalClients: Number(clientCount.count),
    activeClients: Number(activeClientCount.count),
    delinquentClients: Number(delinquentClientCount.count),
    todayCollected, todayPending, todayTotal,
    activeLoans: activeLoanCount,
    totalLent, totalCollected, moneyOnStreet, delinquencyRate,
  });
});

// GET /api/dashboard/cash-flow — últimos 7 días cobrado vs esperado
router.get("/cash-flow", async (req, res) => {
  const bizId = await getBusinessId(req);
  const clientIds = await getClientIds(bizId);
  const loanIds = clientIds !== null ? await getLoanIds(clientIds) : null;
  const days: { date: string; collected: number; expected: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    if (loanIds !== null && loanIds.length === 0) {
      days.push({ date: dateStr, collected: 0, expected: 0 });
      continue;
    }

    const instFilter = loanIds !== null
      ? and(eq(installmentsTable.dueDate, dateStr), inArray(installmentsTable.loanId, loanIds))
      : eq(installmentsTable.dueDate, dateStr);

    const insts = await db
      .select({ amount: installmentsTable.amount, status: installmentsTable.status })
      .from(installmentsTable)
      .where(instFilter);

    let collected = 0;
    let expected = 0;
    for (const inst of insts) {
      const amt = Number(inst.amount);
      expected += amt;
      if (inst.status === "paid") collected += amt;
    }
    days.push({ date: dateStr, collected, expected });
  }

  res.json(days);
});

// GET /api/dashboard/top-cobradores
router.get("/top-cobradores", async (req, res) => {
  const bizId = await getBusinessId(req);
  const today = new Date().toISOString().split("T")[0];

  const cobradores = await db.select().from(usersTable)
    .where(bizId !== null
      ? and(eq(usersTable.role, "cobrador"), eq(usersTable.businessId, bizId))
      : eq(usersTable.role, "cobrador")
    );

  const ranking = await Promise.all(cobradores.map(async (cob) => {
    const cobClients = await db.select({ id: clientsTable.id }).from(clientsTable)
      .where(eq(clientsTable.cobradorId, cob.id));
    const clientIds = cobClients.map(c => c.id);
    if (clientIds.length === 0) return { id: cob.id, name: cob.name, collected: 0, pending: 0, total: 0 };

    const cobLoanIds = await getLoanIds(clientIds);
    if (cobLoanIds.length === 0) return { id: cob.id, name: cob.name, collected: 0, pending: 0, total: 0 };

    const todayInsts = await db
      .select({ amount: installmentsTable.amount, status: installmentsTable.status })
      .from(installmentsTable)
      .where(and(eq(installmentsTable.dueDate, today), inArray(installmentsTable.loanId, cobLoanIds)));

    const collected = todayInsts.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    const total = todayInsts.reduce((s, i) => s + Number(i.amount), 0);

    return { id: cob.id, name: cob.name, collected, pending: total - collected, total };
  }));

  ranking.sort((a, b) => b.collected - a.collected);
  res.json(ranking);
});

// GET /api/dashboard/payment-methods
router.get("/payment-methods", async (req, res) => {
  const bizId = await getBusinessId(req);
  const clientIds = await getClientIds(bizId);
  const loanIds = clientIds !== null ? await getLoanIds(clientIds) : null;

  if (loanIds !== null && loanIds.length === 0) {
    return res.json([
      { name: "Efectivo", value: 0, emoji: "💵" },
      { name: "Transferencia", value: 0, emoji: "🏦" },
      { name: "Otro", value: 0, emoji: "📋" },
    ]);
  }

  const insts = await db
    .select({ paymentMethod: installmentsTable.paymentMethod, amount: installmentsTable.amount })
    .from(installmentsTable)
    .where(loanIds !== null
      ? and(eq(installmentsTable.status, "paid"), inArray(installmentsTable.loanId, loanIds))
      : eq(installmentsTable.status, "paid")
    );

  const breakdown: Record<string, number> = { efectivo: 0, transferencia: 0, otro: 0 };
  for (const inst of insts) {
    const method = inst.paymentMethod ?? "efectivo";
    breakdown[method] = (breakdown[method] ?? 0) + Number(inst.amount);
  }

  res.json([
    { name: "Efectivo", value: breakdown.efectivo, emoji: "💵" },
    { name: "Transferencia", value: breakdown.transferencia, emoji: "🏦" },
    { name: "Otro", value: breakdown.otro, emoji: "📋" },
  ]);
});

export default router;
