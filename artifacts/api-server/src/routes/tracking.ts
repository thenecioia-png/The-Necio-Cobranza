import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { cobradorLocationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { installmentsTable } from "@workspace/db";
import { clientsTable } from "@workspace/db";
import { count } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "No autorizado" });
  next();
}

// POST /api/tracking/ping — cobrador actualiza su ubicación
router.post("/ping", requireAuth, async (req, res) => {
  const userId = req.session.userId as number;
  const { lat, lng } = req.body;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "lat y lng son requeridos" });
  }

  // upsert: si ya existe actualiza, si no inserta
  const existing = await db
    .select({ id: cobradorLocationsTable.id })
    .from(cobradorLocationsTable)
    .where(eq(cobradorLocationsTable.cobradorId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(cobradorLocationsTable)
      .set({ lat, lng, updatedAt: new Date() })
      .where(eq(cobradorLocationsTable.cobradorId, userId));
  } else {
    await db.insert(cobradorLocationsTable).values({ cobradorId: userId, lat, lng });
  }

  res.json({ ok: true });
});

// DELETE /api/tracking/ping — cobrador borra su ubicación al cerrar sesión o apagar GPS
router.delete("/ping", requireAuth, async (req, res) => {
  const userId = req.session.userId as number;
  await db.delete(cobradorLocationsTable).where(eq(cobradorLocationsTable.cobradorId, userId));
  res.json({ ok: true });
});

// GET /api/tracking/cobradores — admin ve todos los cobradores activos en el mapa
router.get("/cobradores", requireAuth, async (req, res) => {
  const userId = req.session.userId as number;
  const [admin] = await db.select({ businessId: usersTable.businessId }).from(usersTable).where(eq(usersTable.id, userId));
  const bizId = admin?.businessId;

  // Dos minutos = activo
  const dos_minutos_atras = new Date(Date.now() - 2 * 60 * 1000);
  const today = new Date().toISOString().split("T")[0];

  const locations = await db
    .select({
      cobradorId: cobradorLocationsTable.cobradorId,
      lat: cobradorLocationsTable.lat,
      lng: cobradorLocationsTable.lng,
      updatedAt: cobradorLocationsTable.updatedAt,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(cobradorLocationsTable)
    .innerJoin(usersTable, eq(cobradorLocationsTable.cobradorId, usersTable.id))
    .where(
      bizId !== null && bizId !== undefined
        ? eq(usersTable.businessId, bizId)
        : undefined
    );

  const result = await Promise.all(
    locations.map(async (loc) => {
      // cobros del día
      const cobClients = await db
        .select({ id: clientsTable.id })
        .from(clientsTable)
        .where(eq(clientsTable.cobradorId, loc.cobradorId));

      let cobrosHoy = 0;
      if (cobClients.length > 0) {
        const [{ total }] = await db
          .select({ total: count() })
          .from(installmentsTable)
          .where(
            and(
              eq(installmentsTable.dueDate, today),
              eq(installmentsTable.status, "paid"),
              eq(installmentsTable.cobradorId, loc.cobradorId)
            )
          );
        cobrosHoy = Number(total);
      }

      const enLinea = loc.updatedAt >= dos_minutos_atras;

      return {
        cobradorId: loc.cobradorId,
        name: loc.name,
        avatarUrl: loc.avatarUrl ?? null,
        lat: loc.lat,
        lng: loc.lng,
        updatedAt: loc.updatedAt.toISOString(),
        enLinea,
        cobrosHoy,
      };
    })
  );

  res.json(result);
});

export default router;
