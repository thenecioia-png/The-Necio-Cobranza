import { Router, type IRouter } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { db, confirmationCodesTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { sendConfirmationCode, isEmailConfigured } from "../lib/mailer";

const router: IRouter = Router();

const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados códigos. Intenta más tarde." },
});

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function verifyConfirmationCode(
  action: string,
  targetId: string | number,
  code: string,
): Promise<boolean> {
  const key = `${action}:${String(targetId)}`;
  const [entry] = await db
    .select()
    .from(confirmationCodesTable)
    .where(
      and(
        eq(confirmationCodesTable.action, action),
        eq(confirmationCodesTable.targetId, String(targetId)),
        eq(confirmationCodesTable.code, String(code)),
        gt(confirmationCodesTable.expiresAt, new Date()),
        isNull(confirmationCodesTable.usedAt),
      ),
    )
    .limit(1);

  if (!entry) return false;

  await db
    .update(confirmationCodesTable)
    .set({ usedAt: new Date() })
    .where(eq(confirmationCodesTable.id, entry.id));
  return true;
}

export async function createPasswordResetToken(
  userId: number,
  email: string,
): Promise<string> {
  const token = generateToken();
  await db.insert(passwordResetTokensTable).values({
    token,
    userId,
    email,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
  });
  return token;
}

export async function verifyPasswordResetToken(
  token: string,
): Promise<{ userId: number; email: string } | null> {
  const [entry] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!entry) return null;

  await db
    .delete(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.token, token));
  return { userId: entry.userId, email: entry.email };
}

// POST /api/confirmations/send
router.post("/send", confirmLimiter, async (req, res) => {
  const { action, targetId, email } = req.body;
  if (!action || !targetId || !email) {
    res.status(400).json({ error: "Faltan datos" });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(503).json({ error: "El servicio de correo no está configurado." });
    return;
  }

  const code = generateCode();

  // Delete any existing pending code for this action+target.
  await db
    .delete(confirmationCodesTable)
    .where(
      and(
        eq(confirmationCodesTable.action, String(action)),
        eq(confirmationCodesTable.targetId, String(targetId)),
      ),
    );

  await db.insert(confirmationCodesTable).values({
    action: String(action),
    targetId: String(targetId),
    code,
    email: String(email),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
  });

  const result = await sendConfirmationCode(email, code, action);

  if (result.sent) {
    res.json({ message: "Código enviado", emailConfigured: true });
  } else {
    res.status(503).json({ error: "No se pudo enviar el correo. Inténtalo más tarde." });
  }
});

// POST /api/confirmations/verify
router.post("/verify", confirmLimiter, async (req, res) => {
  const { action, targetId, code } = req.body;
  if (!action || !targetId || !code) {
    res.status(400).json({ error: "Faltan datos" });
    return;
  }

  const valid = await verifyConfirmationCode(action, targetId, code);
  if (!valid) {
    res.status(400).json({ error: "Código no encontrado, expirado o incorrecto" });
    return;
  }

  res.json({ verified: true });
});

export default router;
