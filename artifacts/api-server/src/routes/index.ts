import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import chatRouter from "./chat";
import usersRouter from "./users";
import postsRouter from "./posts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(chatRouter);
router.use(usersRouter);
router.use(postsRouter);

export default router;
