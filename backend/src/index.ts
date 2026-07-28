import "dotenv/config";
import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { clerkWebhookHandler } from "./webhooks/clerk";
import { polarWeebhookHandler } from "./webhooks/polar";
import { getEnv } from "./lib/env";
import keepAliveCron from "./lib/cron";
import meRouter from "./routes/meRouter";
import productRouter from "./routes/productRouter";
import streamRouter from "./routes/streamRouter";
import checkoutRouter from "./routes/checkoutRouter";

import fs from "node:fs";
import path from "node:path";

const env = getEnv();
const app = express();

const rawJson = express.raw({ type: "application/json", limit: "1mb" });

app.post("/webhooks/clerk", rawJson, (req, res) => {
	void clerkWebhookHandler(req, res);
});

app.post("/webhooks/polar", rawJson, (req, res) => {
	void polarWeebhookHandler(req, res);
});

app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
	res.json({ ok: true });
});

app.use("/api/me", meRouter);
app.use("/api/products", productRouter);
app.use("/api/stream", streamRouter);
app.use("/api/checkout", checkoutRouter);

const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
	app.use(express.static(publicDir));

	app.get("/*splat", (req, res, next) => {
		if (req.method !== "GET" && req.method !== "HEAD") {
			next();
			return;
		}
		res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
	});
}

app.listen(env.PORT, () => {
	console.log(`Listening on port ${env.PORT}`);
	if (env.NODE_ENV === "production") {
		keepAliveCron.start;
	}
});
