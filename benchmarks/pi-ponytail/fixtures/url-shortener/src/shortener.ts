// URL shortening logic: create short codes, resolve them.

import { UrlStore } from "./store.js";

export function createShortCode(): string {
  // TODO: generate random short code (6 alphanumeric chars)
  throw new Error("NotImplementedError");
}

export function shorten(url: string, store: UrlStore): string {
  // TODO: check if URL already shortened, return existing code
  // otherwise generate new code, store mapping, return code
  throw new Error("NotImplementedError");
}

export function resolve(code: string, store: UrlStore): string | undefined {
  // TODO: look up code in store, return URL or undefined
  throw new Error("NotImplementedError");
}
