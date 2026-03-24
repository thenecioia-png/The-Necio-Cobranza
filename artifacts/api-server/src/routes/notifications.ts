import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, installmentsTable, loansTable, usersTable } from "@workspace/db/schema";
import { eq, and, gte, lte, lt } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.user) return res.status(401).json({ error: "No autorizado" });
  next();
}

async function getBusinessId(req: any): Promise<number | null> {
  const user = req.session?.user;
  if (!user) return null;
  const [u] = await db.select({ businessId: usersTable.businessId }).from(usersTable).where(eq(usersTable.id, user.id));
  return u?.businessId ?? null;
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith("1")) return `+${cleaned}`;
  return `+${cleaned}`;
}

async function sendWhatsApp(twilioClient: any, to: string, body: string, from: string) {
  return twilioClient.messages.create({
    from: `whatsapp:${from}`,
    to: `whatsapp:${formatPhone(to)}`,
    body,
  });
}

router.post("/whatsapp/payment-confirmation", requireAuth, async (req, res) => {
  try {
    const { installmentId } = req.body as { installmentId: number };
    if (!installmentId) return res.status(400).json({ error: "installmentId requerido" });

    const businessId = await getBusinessId(req);
    if (!businessId) return res.status(400).json({ error: "Negocio no encontrado" });

    const twilioClient = (req as any).twilioClient;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER;

    if (!twilioClient || !fromNumber) {
      return res.status(503).json({
        error: "Twilio no configurado",
        message: "Conecta Twilio primero para enviar notificaciones WhatsApp.",
      });
    }

    const [inst] = await db
      .select({
        id: installmentsTable.id,
        amount: installmentsTable.amount,
        dueDate: installmentsTable.dueDate,
        clientId: installmentsTable.clientId,
        clientName: clientsTable.name,
        clientPhone: clientsTable.phone,
      })
      .from(installmentsTable)
      .leftJoin(clientsTable, eq(clientsTable.id, installmentsTable.clientId))
      .where(and(eq(installmentsTable.id, installmentId), eq(clientsTable.businessId, businessId)));

    if (!inst || !inst.clientPhone) {
      return res.status(404).json({ error: "Cuota o teléfono no encontrado" });
    }

    const amount = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(inst.amount);
    const message = `✅ *Pago Recibido*\n\nHola ${inst.clientName},\n\nHemos registrado tu pago de *${amount}* correspondiente a tu cuota del ${new Date(inst.dueDate).toLocaleDateString("es-DO")}.\n\n¡Gracias por tu puntualidad! 🙌\n\n_The Necio Cobranza_`;

    const result = await sendWhatsApp(twilioClient, inst.clientPhone, message, fromNumber);
    res.json({ success: true, sid: result.sid, to: inst.clientPhone });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al enviar notificación" });
  }
});

router.post("/whatsapp/payment-reminder", requireAuth, async (req, res) => {
  try {
    const { installmentId } = req.body as { installmentId: number };
    if (!installmentId) return res.status(400).json({ error: "installmentId requerido" });

    const businessId = await getBusinessId(req);
    if (!businessId) return res.status(400).json({ error: "Negocio no encontrado" });

    const twilioClient = (req as any).twilioClient;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER;

    if (!twilioClient || !fromNumber) {
      return res.status(503).json({
        error: "Twilio no configurado",
        message: "Conecta Twilio primero para enviar notificaciones WhatsApp.",
      });
    }

    const [inst] = await db
      .select({
        id: installmentsTable.id,
        amount: installmentsTable.amount,
        dueDate: installmentsTable.dueDate,
        clientName: clientsTable.name,
        clientPhone: clientsTable.phone,
      })
      .from(installmentsTable)
      .leftJoin(clientsTable, eq(clientsTable.id, installmentsTable.clientId))
      .where(and(eq(installmentsTable.id, installmentId), eq(clientsTable.businessId, businessId)));

    if (!inst || !inst.clientPhone) {
      return res.status(404).json({ error: "Cuota o teléfono no encontrado" });
    }

    const amount = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(inst.amount);
    const dueDate = new Date(inst.dueDate).toLocaleDateString("es-DO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const message = `⏰ *Recordatorio de Pago*\n\nHola ${inst.clientName},\n\nTe recordamos que tienes una cuota de *${amount}* con vencimiento el *${dueDate}*.\n\nPor favor asegúrate de tener el monto listo para el cobrador.\n\n_The Necio Cobranza_`;

    const result = await sendWhatsApp(twilioClient, inst.clientPhone, message, fromNumber);
    res.json({ success: true, sid: result.sid, to: inst.clientPhone });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al enviar recordatorio" });
  }
});

router.post("/whatsapp/bulk-reminders", requireAuth, async (req, res) => {
  try {
    const businessId = await getBusinessId(req);
    if (!businessId) return res.status(400).json({ error: "Negocio no encontrado" });

    const twilioClient = (req as any).twilioClient;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER;

    if (!twilioClient || !fromNumber) {
      return res.status(503).json({
        error: "Twilio no configurado",
        message: "Conecta Twilio primero.",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const upcoming = await db
      .select({
        id: installmentsTable.id,
        amount: installmentsTable.amount,
        dueDate: installmentsTable.dueDate,
        clientName: clientsTable.name,
        clientPhone: clientsTable.phone,
      })
      .from(installmentsTable)
      .leftJoin(clientsTable, eq(clientsTable.id, installmentsTable.clientId))
      .where(
        and(
          eq(clientsTable.businessId, businessId),
          eq(installmentsTable.status, "pending"),
          gte(installmentsTable.dueDate, tomorrow.toISOString().split("T")[0]),
          lt(installmentsTable.dueDate, dayAfter.toISOString().split("T")[0])
        )
      );

    let sent = 0;
    let failed = 0;

    for (const inst of upcoming) {
      if (!inst.clientPhone) { failed++; continue; }
      try {
        const amount = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(inst.amount);
        const message = `⏰ *Recordatorio de Pago*\n\nHola ${inst.clientName},\n\nTu cuota de *${amount}* vence mañana.\n\nNuestro cobrador pasará a recoger el pago. ¡Gracias!\n\n_The Necio Cobranza_`;
        await sendWhatsApp(twilioClient, inst.clientPhone, message, fromNumber);
        sent++;
      } catch {
        failed++;
      }
    }

    res.json({ success: true, sent, failed, total: upcoming.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al enviar recordatorios" });
  }
});

router.get("/whatsapp/status", requireAuth, async (req, res) => {
  const twilioClient = (req as any).twilioClient;
  res.json({
    configured: !!twilioClient,
    fromNumber: twilioClient ? (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER || null) : null,
  });
});

export default router;
