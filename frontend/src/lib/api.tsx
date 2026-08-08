import * as Sentry from "@sentry/react";

const raw: any = import.meta.env.VITE_API_URL;

const base: string = typeof raw === "string" ? raw.replace(/\/+$/, "") : "";

type ApiFetchOptions = {
	getToken?: () => string | Promise<string | undefined> | undefined;
	method?: string;
	body?: unknown;
};
export async function apiFetch(path: string, opts: ApiFetchOptions) {
	const { getToken, method = "GET", body } = opts;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (getToken) {
		const token = await getToken();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}
	}

	let res: Response;
	try {
		res = await fetch(`${base}${path}`, {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	} catch (e) {
		Sentry.addBreadcrumb({
			category: "api",
			message: `${method} ${path}`,
			level: "error",
			data: { network: true },
		});
		Sentry.captureException(e, {
			tags: { "api.fetch": "network" },
			extra: { path, method },
		});
		throw e;
	}

	const data = await res.json();

	Sentry.addBreadcrumb({
		category: "api",
		message: `${method} ${path}`,
		level: res.ok ? "info" : "warning",
		data: { status: res.status },
	});
	if (!res.ok) {
		const msg: any =
			typeof data?.error === "string" ? data.error : res.statusText;
		const err = new Error(typeof msg === "string" ? msg : "Request failed");
		if (res.status >= 500) {
			Sentry.captureException(err, {
				tags: { "api.fetch": "http", "http.status": String(res.status) },
				extra: { path, method, status: res.status },
			});
		}
		throw err;
	}
	return data;
}
