import { Router, type IRouter } from "express";
import { db, installmentsTable, loansTable, clientsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { PayInstallmentParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/today", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const rows = await db
    .select({
      id: installmentsTable.id,
      loanId: installmentsTable.loanId,
      dueDate: installmentsTable.dueDate,
      amount: installmentsTable.amount,
      status: installmentsTable.status,
      paidAt: installmentsTable.paidAt,
      clientName: clientsTable.name,
      clientPhone: clientsTable.phone,
      loanFrequency: loansTable.frequency,
    })
    .from(installmentsTable)
    .innerJoin(loansTable, eq(installmentsTable.loanId, loansTable.id))
    .innerJoin(clientsTable, eq(loansTable.clientId, clientsTable.id))
    .where(eq(installmentsTable.dueDate, today))
    .orderBy(installmentsTable.status);

  res.json(rows.map(r => ({
    id: r.id,
    loanId: r.loanId,
    dueDate: r.dueDate,
    amount: Number(r.amount),
    status: r.status,
    paidAt: r.paidAt?.toISOString() ?? undefined,
    clientName: r.clientName,
    clientPhone: r.clientPhone ?? undefined,
    loanFrequency: r.loanFrequency,
  })));
});

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

  const [updated] = await db
    .update(installmentsTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(installmentsTable.id, parsed.data.id))
    .returning();

  res.json({
    id: updated.id,
    loanId: updated.loanId,
    dueDate: updated.dueDate,
    amount: Number(updated.amount),
    status: updated.status,
    paidAt: updated.paidAt?.toISOString() ?? undefined,
  });
});

export default router;
