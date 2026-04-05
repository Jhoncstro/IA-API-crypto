import { Router, type IRouter } from "express";
import transactionsRouter from "./transactions";
import gatewaysRouter from "./gateways";
import marketRouter from "./market";

const router: IRouter = Router();

router.use(transactionsRouter);
router.use(gatewaysRouter);
router.use(marketRouter);

export default router;
