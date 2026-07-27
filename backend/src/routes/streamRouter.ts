import { Router } from "express";
import { createStreamToken } from "../controllers/streamContoller";

const router = Router();

router.post("/token", createStreamToken);

export default router;
