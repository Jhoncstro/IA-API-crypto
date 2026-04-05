import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import financeRouter from "./finance";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", openaiRouter);
router.use("/finance", financeRouter);

export default router;
