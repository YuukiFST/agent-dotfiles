// App factory: creates and configures the Hono app.

import { Hono } from "hono";
import { createRoutes } from "./http.js";

export function createApp(): Hono {
  const app = new Hono();
  createRoutes(app);
  return app;
}
