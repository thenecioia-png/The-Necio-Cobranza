import { Router, type IRouter } from "express";
import { db, usersTable, expensesTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

async function getBusinessId(req: any): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.businessId ?? null;
}

const CreateExpenseBody = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

const UpdateExpenseBody = CreateExpenseBody.partial();

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD&category=gasolina
router.get("/", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const { from, to, category } = req.query as Record<string, string>;

  let conditions: any[] = [eq(expensesTable.businessId, businessId)];
  if (from) conditions.push(gte(expensesTable.date, from));
  if (to) conditions.push(lte(expensesTable.date, to));
  if (category) conditions.push(eq(expensesTable.category, category));

  const rows = await db
    .select()
    .from(expensesTable)
    .where(and(...conditions))
    .orderBy(desc(expensesTable.date), desc(expensesTable.createdAt));

  res.json(rows.map(e => ({
    id: e.id,
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    date: e.date,
    notes: e.notes ?? null,
    createdAt: e.createdAt,
  })));
});

// GET /api/expenses/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/summary", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const { from, to } = req.query as Record<string, string>;

  let conditions: any[] = [eq(expensesTable.businessId, businessId)];
  if (from) conditions.push(gte(expensesTable.date, from));
  if (to) conditions.push(lte(expensesTable.date, to));

  const rows = await db
    .select()
    .from(expensesTable)
    .where(and(...conditions));

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    byCategory[r.category] = (byCategory[r.category] ?? 0) + amt;
    total += amt;
  }

  res.json({ byCategory, total, count: rows.length });
});

// POST /api/expenses
router.post("/", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const body = req.body;
  if (body.amount !== undefined) body.amount = Number(body.amount);
  const parsed = CreateExpenseBody.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const { category, description, amount, date, notes } = parsed.data;

  const [created] = await db
    .insert(expensesTable)
    .values({ businessId, category, description, amount: String(amount), date, notes: notes ?? null })
    .returning();

  res.status(201).json({
    id: created.id,
    category: created.category,
    description: created.description,
    amount: Number(created.amount),
    date: created.date,
    notes: created.notes ?? null,
    createdAt: created.createdAt,
  });
});

// PUT /api/expenses/:id
router.put("/:id", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const body = req.body;
  if (body.amount !== undefined) body.amount = Number(body.amount);
  const parsed = UpdateExpenseBody.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const [existing] = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.businessId, businessId)))
    .limit(1);

  if (!existing) return res.status(404).json({ error: "Gasto no encontrado" });

  const updates: any = { ...parsed.data };
  if (updates.amount !== undefined) updates.amount = String(updates.amount);

  const [updated] = await db
    .update(expensesTable)
    .set(updates)
    .where(eq(expensesTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    category: updated.category,
    description: updated.description,
    amount: Number(updated.amount),
    date: updated.date,
    notes: updated.notes ?? null,
    createdAt: updated.createdAt,
  });
});

// DELETE /api/expenses/:id
router.delete("/:id", async (req: any, res) => {
  const businessId = await getBusinessId(req);
  if (!businessId) return res.status(401).json({ error: "No autenticado" });

  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const [existing] = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.businessId, businessId)))
    .limit(1);

  if (!existing) return res.status(404).json({ error: "Gasto no encontrado" });

  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.json({ ok: true });
});

export default router;
