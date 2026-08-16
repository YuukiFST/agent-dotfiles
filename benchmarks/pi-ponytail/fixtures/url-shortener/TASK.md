# URL Shortener

Implement a URL shortener service with two endpoints:

1. **POST /shorten** — accepts `{ "url": "..." }` and returns `{ "code": "..." }`.
2. **GET /:code** — redirects (302 or 307) to the original URL, or returns 404 if unknown.

## Requirements

- Reject invalid URLs with 400: non-http(s) schemes, empty strings, `javascript:`, whitespace-only.
- Distinct URLs must produce distinct short codes.
- Store URLs in process memory for the lifetime of the app instance.

## Technical Notes

- Stack: Node.js + TypeScript + Hono.
- The stubs are already wired in `src/`. Fill in the implementations.
- Run `npm run build` to verify TypeScript compiles.
- Export `createApp()` from `src/app.ts` for testability.
