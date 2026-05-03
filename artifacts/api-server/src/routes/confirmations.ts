import { Router, type IRouter } from "express";
import crypto from "crypto";
import { sendConfirmationCode, sendPasswordReset, isEmailConfigured } from "../lib/mailer";

const router: IRouter = Router();

interface CodeEntry {
  code: string;
  action: string;
  targetId: string;
  email: string;
  expiresAt: number;
}

const codeStore = new Map<string, CodeEntry>();

// Password reset tokens
interface ResetTokenEntry {
  userId: number;
  email: string;
  expiresAt: number;
}
const resetTokenStore = new Map<string, ResetTokenEntry>();

function generateCode(action?: string): string {
  // Código fijo para eliminaciones (según solicitud del usuario)
  if (action === "delete-client" || action === "delete-loan") {
    return "190021";
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getKey(action: string, targetId: string): string {
  return `${action}:${targetId}`;
}

export function verifyConfirmationCode(action: string, targetId: string, code: string): boolean {
  const key = getKey(action, String(targetId));
  const entry = codeStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    codeStore.delete(key);
    return false;
  }
  if (entry.code !== String(code)) return false;
  codeStore.delete(key);
  return true;
}

export function createPasswordResetToken(userId: number, email: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  resetTokenStore.set(token, {
    userId,
    email,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hora
  });
  return token;
}

export function verifyPasswordResetToken(token: string): { userId: number; email: string } | null {
  const entry = resetTokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    resetTokenStore.delete(token);
    return null;
  }
  resetTokenStore.delete(token);
  return { userId: entry.userId, email: entry.email };
}

// POST /api/confirmations/send
router.post("/send", async (req, res) => {
  const { action, targetId, email } = req.body;
  if (!action || !targetId || !email) {
    res.status(400).json({ error: "Faltan datos" });
    return;
  }

  const code = generateCode(action);
  const key = getKey(action, String(targetId));
  codeStore.set(key, {
    code,
    action: String(action),
    targetId: String(targetId),
    email: String(email),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutos
  });

  const result = await sendConfirmationCode(email, code, action);

  if (result.sent) {
    res.json({ message: "Código enviado", emailConfigured: true });
  } else {
    // Fallback: devolver el código en la respuesta para que el frontend lo muestre
    res.json({ message: "Código generado (email no configurado)", code, emailConfigured: false });
  }
});

// POST /api/confirmations/verify
router.post("/verify", async (req, res) => {
  const { action, targetId, code } = req.body;
  if (!action || !targetId || !code) {
    res.status(400).json({ error: "Faltan datos" });
    return;
  }

  const key = getKey(action, String(targetId));
  const entry = codeStore.get(key);

  if (!entry) {
    res.status(400).json({ error: "Código no encontrado o expirado" });
    return;
  }

  if (Date.now() > entry.expiresAt) {
    codeStore.delete(key);
    res.status(400).json({ error: "Código expirado" });
    return;
  }

  if (entry.code !== String(code)) {
    res.status(400).json({ error: "Código incorrecto" });
    return;
  }

  // Marcar como verificado (eliminar para evitar reuso)
  codeStore.delete(key);
  res.json({ verified: true });
});

export default router;
