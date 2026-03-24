import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

declare module "express-serve-static-core" {
  interface Request {
    session?: { userId?: number };
  }
}

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const { username, password } = parsed.data;
  const passwordHash = hashPassword(password);

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  const user = users[0];
  if (!user || user.passwordHash !== passwordHash) {
    res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    return;
  }

  (req.session as any).userId = user.id;

  res.json({
    user: { id: user.id, username: user.username, name: user.name },
    message: "Sesión iniciada"
  });
});

router.post("/logout", (req, res) => {
  (req as any).session = null;
  res.json({ message: "Sesión cerrada" });
});

router.get("/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const user = users[0];
  if (!user) {
    res.status(401).json({ error: "Usuario no encontrado" });
    return;
  }

  res.json({ id: user.id, username: user.username, name: user.name });
});

export default router;
