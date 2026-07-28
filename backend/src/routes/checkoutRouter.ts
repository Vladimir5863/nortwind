import { Router } from "express";
import { createCheckout } from "../controllers/checkoutConrtoller";

const router = Router();

router.post("/", createCheckout);

export default router;
