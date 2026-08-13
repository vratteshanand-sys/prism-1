import { Router, type IRouter } from "express";
import healthRouter from "./health";
import supplychainRouter from "./supplychain";
import sentinelRouter from "./sentinel";
import trustlensRouter from "./trustlens";
import finguardRouter from "./finguard";
import dashboardRouter from "./dashboard";
import devicescanRouter from "./devicescan";
import guardRouter from "./guard";
import guardTrustRouter from "./guard-trust";
import deepscanRouter from "./deepscan";
import sharesRouter from "./shares";

const router: IRouter = Router();

router.use(healthRouter);
router.use(supplychainRouter);
router.use(sentinelRouter);
router.use(trustlensRouter);
router.use(finguardRouter);
router.use(devicescanRouter);
router.use(guardRouter);
router.use(guardTrustRouter);
router.use(deepscanRouter);
router.use(sharesRouter);
router.use(dashboardRouter);

export default router;
