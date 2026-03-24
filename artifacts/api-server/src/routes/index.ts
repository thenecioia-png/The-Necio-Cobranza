import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import loansRouter from "./loans";
import installmentsRouter from "./installments";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/clients", clientsRouter);
router.use("/loans", loansRouter);
router.use("/installments", installmentsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
