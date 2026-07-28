import { Request, Response } from "express";
import { getEnv } from "../lib/env";
import { checkoutSession, orderItems, orders } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { Webhook } from "standardwebhooks";

function headerString(headers: Request["headers"], name: string) {
	const value = headers[name];
	return Array.isArray(value) ? value[0] : value;
}

async function alreadyPaid(polarOrderId?: string, checkoutId?: string) {
	if (polarOrderId) {
		const [row] = await db
			.select()
			.from(orders)
			.where(eq(orders.polarOrderId, polarOrderId))
			.limit(1);
		if (row?.status === "paid") return true;
	}
	if (checkoutId) {
		const [row] = await db
			.select()
			.from(orders)
			.where(eq(orders.polarCheckoutId, checkoutId))
			.limit(1);
		if (row?.status === "paid") return true;
	}
	return false;
}

function checkoutSessionIdFromMetaData(order: Record<string, unknown>) {
	const metadata = order.metadata;
	if (!metadata || typeof metadata !== "object") return undefined;
	const sessionId = (metadata as Record<string, unknown>).checkout_session_id;
	return typeof sessionId === "string" ? sessionId : undefined;
}

async function fulfillCheckoutSession(
	sessionId: string,
	polarOrderId: string | undefined,
	checkoutId: string | undefined,
) {
	return await db.transaction(async (tx) => {
		const [session] = await tx
			.select()
			.from(checkoutSession)
			.where(eq(checkoutSession.id, sessionId))
			.for("update");
		if (!session) return false;
		const [order] = await tx
			.insert(orders)
			.values({
				userId: session.userId,
				status: "paid",
				totalCents: session.totalCents,
				polarCheckoutId: checkoutId ?? session.polarCheckoutId ?? null,
				...(polarOrderId ? { polarOrderId } : {}),
			})
			.returning();

		if (session.lines.length) {
			await tx.insert(orderItems).values(
				session.lines.map((line) => ({
					orderId: order.id,
					productId: line.productId,
					quantity: line.quantity,
					unitPriceCents: line.unitPriceCents,
				})),
			);
		}
		await tx
			.delete(checkoutSession)
			.where(eq(checkoutSession.id, checkoutSession));
		return true;
	});
}

export async function polarWeebhookHandler(req: Request, res: Response) {
	const env = getEnv();
	try {
		if (!env.POLAR_WEBHOOK_SECTER) {
			res.status(503).send("Polar weebhook not configured");
			return;
		}
		const raw =
			req.body instanceof Buffer ? req.body : Buffer.from(String(req.body));
		const wh = new Webhook(
			Buffer.from(env.POLAR_WEBHOOK_SECTER, "utf8").toString("base64"),
		);

		const id = headerString(req.headers, "webhook-id");
		const ts = headerString(req.headers, "webhook-timestamp");
		const sig = headerString(req.headers, "webhook-signature");

		if (!id || !ts || !sig) {
			res.status(400).json({ error: "Missing webhook headers" });
			return;
		}

		wh.verify(raw, {
			"webhook-id": id,
			"webhook-signature": sig,
			"webhook-timestamp": ts,
		});

		const event = JSON.parse(raw.toString("utf8")) as {
			type: string;
			data?: Record<string, unknown>;
		};

		if (event.type === "order.paid" && event.data) {
			const data = event.data;
			const polarOrderId = typeof data.id === "string" ? data.id : undefined;
			const checkoutId =
				typeof data.checkout_id === "string" ? data.checkout_id : undefined;

			if (await alreadyPaid(polarOrderId, checkoutId)) {
				res.json({ ok: true, duplicate: true });
			}
			const sessionId = checkoutSessionIdFromMetaData(data);

			if (sessionId) {
				const ok = await fulfillCheckoutSession(
					sessionId,
					polarOrderId,
					checkoutId,
				);
				if (ok) {
					res.json({ ok: true });
					return;
				}
				if (await alreadyPaid(polarOrderId, checkoutId)) {
					res.json({ ok: true, duplicate: true });
					return;
				}
				console.error("Polar order.paid: could not fulfill checkout session", {
					sessionId,
					checkoutId,
				});
				res.status(500).json({ error: "Checkout fulfillment failed" });
			}
		}
		res.json({ ok: true });
	} catch (e) {
		console.error("Polar webhook error ", e);
		res.status(400).json({ error: "Invalid webhook" });
	}
}
