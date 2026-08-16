import { Hono } from "hono";
import { createUrlStore } from "./store.js";
import { isValidUrl } from "./validate.js";
import { shorten, resolve } from "./shortener.js";

export function createRoutes(app: Hono) {
  const store = createUrlStore();

  app.post("/shorten", async (c) => {
    let body: { url?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const url = body?.url;
    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return c.json({ error: "URL is required" }, 400);
    }
    if (!isValidUrl(url)) {
      return c.json({ error: "Invalid URL: must be http or https" }, 400);
    }
    const code = shorten(url, store);
    return c.json({ code });
  });

  app.get("/:code", async (c) => {
    const code = c.req.param("code");
    const url = resolve(code, store);
    if (!url) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.redirect(url, 302);
  });
}
