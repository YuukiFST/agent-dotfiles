import { UrlStore } from "./store.js";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 6;

export function createShortCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export function shorten(url: string, store: UrlStore): string {
  const existing = store.getCodeForUrl(url);
  if (existing) return existing;
  let code = createShortCode();
  while (store.get(code)) {
    code = createShortCode();
  }
  store.save(code, url);
  return code;
}

export function resolve(code: string, store: UrlStore): string | undefined {
  return store.get(code);
}
