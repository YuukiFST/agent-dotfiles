import { Hono } from "hono";
import { createUrlStore } from "./store.js";
import { shorten, resolve } from "./shortener.js";

export function createRoutes(app: Hono) {
  const store = createUrlStore();

  app.post("/shorten", async (c) => {
    const body = await c.req.json();
    const code = shorten(body.url, store);
    return c.json({ code });
  });

  app.get("/:code", async (c) => {
    const code = c.req.param("code");
    const url = resolve(code, store);
    // Bad: no 404, always redirects (will fail if url undefined)
    return c.redirect(url!, 302);
  });
}
