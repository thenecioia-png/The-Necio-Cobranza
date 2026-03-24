import express, { Router } from "express";
import { db } from "@workspace/db";
import { businessesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

const PLANS = {
  basic: {
    name: "Basic",
    price: 0,
    clientLimit: 50,
    features: ["Hasta 50 clientes", "Dashboard KPIs", "Ruta diaria", "GPS y foto en pagos"],
  },
  pro: {
    name: "Pro",
    price: 29,
    clientLimit: null,
    features: ["Clientes ilimitados", "Todo en Basic", "Cobradores ilimitados", "Notificaciones WhatsApp", "Exportar reportes", "Soporte prioritario"],
  },
  enterprise: {
    name: "Enterprise",
    price: 99,
    clientLimit: null,
    features: ["Todo en Pro", "Multi-sucursal", "API personalizada", "Gerente de cuenta", "SLA garantizado"],
  },
};

router.get("/plans", (_req, res) => {
  res.json(PLANS);
});

router.get("/subscription", requireAuth, async (req, res) => {
  try {
    const businessId = await getBusinessId(req);
    if (!businessId) return res.status(400).json({ error: "Negocio no encontrado" });

    const [business] = await db.select().from(businessesTable).where(eq(businessesTable.id, businessId));
    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    const plan = PLANS[business.planType as keyof typeof PLANS] || PLANS.basic;
    res.json({
      plan: business.planType,
      planName: plan.name,
      price: plan.price,
      clientLimit: plan.clientLimit,
      features: plan.features,
      subscriptionStatus: business.subscriptionStatus,
      stripeCustomerId: business.stripeCustomerId,
      hasActiveSubscription: business.subscriptionStatus === "active",
    });
  } catch (e) {
    res.status(500).json({ error: "Error al obtener suscripción" });
  }
});

router.post("/create-checkout", requireAuth, async (req, res) => {
  try {
    const { plan } = req.body as { plan: "pro" | "enterprise" };
    if (!["pro", "enterprise"].includes(plan)) {
      return res.status(400).json({ error: "Plan inválido" });
    }

    const businessId = await getBusinessId(req);
    if (!businessId) return res.status(400).json({ error: "Negocio no encontrado" });

    const [business] = await db.select().from(businessesTable).where(eq(businessesTable.id, businessId));
    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    const stripeClient = (req as any).stripeClient;
    if (!stripeClient) {
      return res.status(503).json({ error: "Stripe no configurado. Conecta tu cuenta de Stripe primero." });
    }

    let customerId = business.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        name: business.name,
        metadata: { businessId: String(businessId) },
      });
      customerId = customer.id;
      await db.update(businessesTable).set({ stripeCustomerId: customerId }).where(eq(businessesTable.id, businessId));
    }

    const PRICE_IDS: Record<string, string> = {
      pro: process.env.STRIPE_PRO_PRICE_ID || "price_pro_placeholder",
      enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || "price_enterprise_placeholder",
    };

    const baseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${baseUrl}/billing?success=1`,
      cancel_url: `${baseUrl}/billing?cancelled=1`,
      metadata: { businessId: String(businessId), plan },
    });

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al crear sesión de pago" });
  }
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req: any, res) => {
  const stripeClient = req.stripeClient;
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeClient || !webhookSecret) {
    return res.status(200).json({ received: true });
  }

  let event: any;
  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch {
    return res.status(400).json({ error: "Webhook signature inválida" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const businessId = parseInt(session.metadata?.businessId);
    const plan = session.metadata?.plan as string;
    if (businessId && plan) {
      await db.update(businessesTable)
        .set({ planType: plan, subscriptionStatus: "active", stripeSubscriptionId: session.subscription })
        .where(eq(businessesTable.id, businessId));
    }
  }

  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.paused") {
    const sub = event.data.object;
    await db.update(businessesTable)
      .set({ planType: "basic", subscriptionStatus: "inactive" })
      .where(eq(businessesTable.stripeCustomerId, sub.customer));
  }

  res.json({ received: true });
});

router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const businessId = await getBusinessId(req);
    if (!businessId) return res.status(400).json({ error: "Negocio no encontrado" });

    const [business] = await db.select().from(businessesTable).where(eq(businessesTable.id, businessId));
    const stripeClient = (req as any).stripeClient;

    if (business?.stripeSubscriptionId && stripeClient) {
      await stripeClient.subscriptions.cancel(business.stripeSubscriptionId);
    }

    await db.update(businessesTable)
      .set({ planType: "basic", subscriptionStatus: "inactive", stripeSubscriptionId: null })
      .where(eq(businessesTable.id, businessId));

    res.json({ success: true, message: "Suscripción cancelada. Tu plan fue revertido a Basic." });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al cancelar" });
  }
});

export default router;
