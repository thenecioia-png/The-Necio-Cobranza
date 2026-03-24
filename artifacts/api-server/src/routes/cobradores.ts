import { Router, type IRouter } from "express";
import { db, usersTable, clientsTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { installmentsTable } from "@workspace/db";
import { loansTable } from "@workspace/db";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(p: string) {
  return crypto.createHash("sha256").update(p).digest("hex");
}

async function getAdminUser(req: any) {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ?? null;
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.userId) { res.status(401).json({ error: "No autenticado" }); return; }
  next();
}

// GET /api/cobradores — list cobradores in same business
router.get("/", requireAdmin, async (req, res) => {
  const admin = await getAdminUser(req);
  const bizId = admin?.businessId;

  const cobradores = await db.select().from(usersTable).where(
    bizId !== null && bizId !== undefined
      ? and(eq(usersTable.role, "cobrador"), eq(usersTable.businessId, bizId))
      : eq(usersTable.role, "cobrador")
  );
  const today = new Date().toISOString().split("T")[0];

  const withStats = await Promise.all(cobradores.map(async (cob) => {
    const [{ clientCount }] = await db
      .select({ clientCount: count() })
      .from(clientsTable)
      .where(eq(clientsTable.cobradorId, cob.id));

    const cobClients = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.cobradorId, cob.id));

    const clientIds = cobClients.map(c => c.id);

    let cuotasHoy = 0;
    let totalHoy = 0;
    let cobradoHoy = 0;

    if (clientIds.length > 0) {
      const todayInstallments = await db
        .select({ status: installmentsTable.status, amount: installmentsTable.amount })
        .from(installmentsTable)
        .innerJoin(loansTable, eq(installmentsTable.loanId, loansTable.id))
        .where(and(
          eq(installmentsTable.dueDate, today),
          sql`${loansTable.clientId} = ANY(ARRAY[${sql.raw(clientIds.join(","))}]::int[])`
        ));

      cuotasHoy = todayInstallments.length;
      totalHoy = todayInstallments.reduce((s, i) => s + Number(i.amount), 0);
      cobradoHoy = todayInstallments.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    }

    return {
      id: cob.id,
      username: cob.username,
      name: cob.name,
      role: cob.role,
      createdAt: cob.createdAt.toISOString(),
      stats: { clientCount: Number(clientCount), cuotasHoy, totalHoy, cobradoHoy },
    };
  }));

  res.json(withStats);
});

// POST /api/cobradores — create cobrador in same business as admin
router.post("/", requireAdmin, async (req, res) => {
  const admin = await getAdminUser(req);
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    res.status(400).json({ error: "username, password y name son requeridos" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "El usuario ya existe" });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash: hashPassword(password),
    name,
    role: "cobrador",
    businessId: admin?.businessId ?? null,
  }).returning();

  res.status(201).json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    stats: { clientCount: 0, cuotasHoy: 0, totalHoy: 0, cobradoHoy: 0 },
  });
});

// PATCH /api/cobradores/:id
router.patch("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, password } = req.body;

  const updates: Record<string, string> = {};
  if (name) updates.name = name;
  if (password) updates.passwordHash = hashPassword(password);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nada que actualizar" });
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Cobrador no encontrado" }); return; }

  res.json({ id: updated.id, username: updated.username, name: updated.name, role: updated.role });
});

// DELETE /api/cobradores/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const [cob] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "cobrador"))).limit(1);
  if (!cob) { res.status(404).json({ error: "Cobrador no encontrado" }); return; }

  await db.update(clientsTable).set({ cobradorId: null }).where(eq(clientsTable.cobradorId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

export default router;
