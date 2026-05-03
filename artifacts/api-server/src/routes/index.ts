import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import loansRouter from "./loans";
import installmentsRouter from "./installments";
import dashboardRouter from "./dashboard";
import cobradoresRouter from "./cobradores";
import storageRouter from "./storage";
import stripeRouter from "./stripe";
import notificationsRouter from "./notifications";
import backupRouter from "./backup";
import contractsRouter from "./contracts";
import expensesRouter from "./expenses";
import trackingRouter from "./tracking";
import confirmationsRouter from "./confirmations";
import { requireAuth } from "../middleware/auth";
import { getUncachableStripeClient } from "../lib/stripe";

const router: IRouter = Router();

// Inject Stripe client via Replit connector (uncachable — tokens expire)
router.use(async (req: any, _res, next) => {
  try {
    req.stripeClient = await getUncachableStripeClient();
  } catch {
    req.stripeClient = null;
  }
  next();
});

// Inject Twilio client if available
router.use((req: any, _res, next) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (accountSid && authToken) {
    try {
      const twilio = require("twilio");
      req.twilioClient = twilio(accountSid, authToken);
    } catch {}
  }
  next();
});

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/clients", requireAuth, clientsRouter);
router.use("/loans", requireAuth, loansRouter);
router.use("/installments", requireAuth, installmentsRouter);
router.use("/dashboard", requireAuth, dashboardRouter);
router.use("/cobradores", requireAuth, cobradoresRouter);
router.use(storageRouter); // storage routes have their own /storage prefix and public endpoints
router.use("/stripe", requireAuth, stripeRouter);
router.use("/notifications", requireAuth, notificationsRouter);
router.use("/backup", requireAuth, backupRouter);
router.use("/contracts", requireAuth, contractsRouter);
router.use("/expenses", requireAuth, expensesRouter);
router.use("/tracking", requireAuth, trackingRouter);
router.use("/confirmations", requireAuth, confirmationsRouter);

export default router;
