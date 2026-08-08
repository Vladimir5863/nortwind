import { Router } from "express";
import {
	listOrders,
	getOrder,
	createStreamChannel,
	createVideoInvite,
} from "../controllers/orderController";

const router = Router();

router.get("/", listOrders);
router.get("/:id", getOrder);
router.get("/:id/stream-channel", createStreamChannel);
router.get("/:id/video-invite", createVideoInvite);
export default router;
