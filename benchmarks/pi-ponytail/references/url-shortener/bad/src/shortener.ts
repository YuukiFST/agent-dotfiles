import { UrlStore } from "./store.js";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function createShortCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export function shorten(url: string, store: UrlStore): string {
  const code = createShortCode();
  store.save(code, url);
  return code;
}

export function resolve(code: string, store: UrlStore): string | undefined {
  return store.get(code);
}
