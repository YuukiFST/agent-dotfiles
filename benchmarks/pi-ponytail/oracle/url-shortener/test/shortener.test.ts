import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../src/app.js";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp();
});

function shorten(app: ReturnType<typeof createApp>, url: string) {
  return app.request("/shorten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

describe("POST /shorten", () => {
  it("returns a code for a valid URL", async () => {
    const res = await shorten(app, "https://example.com");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("code");
    expect(typeof body.code).toBe("string");
    expect(body.code.length).toBeGreaterThan(0);
  });

  it("rejects empty URL with 400", async () => {
    const res = await shorten(app, "");
    expect(res.status).toBe(400);
  });

  it("rejects whitespace-only URL with 400", async () => {
    const res = await shorten(app, "   ");
    expect(res.status).toBe(400);
  });

  it("rejects javascript: scheme with 400", async () => {
    const res = await shorten(app, "javascript:alert(1)");
    expect(res.status).toBe(400);
  });

  it("rejects non-http scheme with 400", async () => {
    const res = await shorten(app, "ftp://files.example.com");
    expect(res.status).toBe(400);
  });

  it("gives distinct codes for distinct URLs", async () => {
    const res1 = await shorten(app, "https://example.com/a");
    const res2 = await shorten(app, "https://example.com/b");
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.code).not.toBe(body2.code);
  });

  it("gives same code for same URL (idempotent)", async () => {
    const res1 = await shorten(app, "https://example.com/dup");
    const res2 = await shorten(app, "https://example.com/dup");
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.code).toBe(body2.code);
  });
});

describe("GET /:code", () => {
  it("redirects to original URL", async () => {
    const postRes = await shorten(app, "https://example.com/redirect");
    const { code } = await postRes.json();

    const getRes = await app.request(`/${code}`);
    expect([301, 302, 307, 308]).toContain(getRes.status);
    expect(getRes.headers.get("location")).toBe("https://example.com/redirect");
  });

  it("returns 404 for unknown code", async () => {
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
  });
});
