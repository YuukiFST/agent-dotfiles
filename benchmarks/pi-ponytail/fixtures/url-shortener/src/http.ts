// Hono HTTP routes: POST /shorten, GET /:code

import { Hono } from "hono";
import { createUrlStore } from "./store.js";
import { isValidUrl } from "./validate.js";
import { shorten, resolve } from "./shortener.js";

export function createRoutes(app: Hono) {
  const store = createUrlStore();

  // POST /shorten
  app.post("/shorten", async (c) => {
    // TODO: parse JSON body, validate URL, shorten, return { code }
    return c.json({ error: "NotImplementedError" }, 501);
  });

  // GET /:code
  app.get("/:code", async (c) => {
    // TODO: resolve code, redirect or 404
    return c.json({ error: "NotImplementedError" }, 501);
  });
}
