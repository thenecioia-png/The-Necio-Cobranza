import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-serve-static-core" {
  interface Request {
    currentUser?: typeof usersTable.$inferSelect;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as any)?.userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  req.currentUser = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as any)?.userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    res.status(403).json({ error: "Solo los administradores pueden acceder" });
    return;
  }
  req.currentUser = user;
  next();
}
