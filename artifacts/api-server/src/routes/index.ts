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
router.use("/clients", clientsRouter);
router.use("/loans", loansRouter);
router.use("/installments", installmentsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/cobradores", cobradoresRouter);
router.use(storageRouter);
router.use("/stripe", stripeRouter);
router.use("/notifications", notificationsRouter);
router.use("/backup", backupRouter);

export default router;
