// In-memory URL store. Maps short codes to original URLs.

export interface UrlStore {
  save(code: string, url: string): void;
  get(code: string): string | undefined;
  hasUrl(url: string): boolean;
  getCodeForUrl(url: string): string | undefined;
}

export function createUrlStore(): UrlStore {
  // TODO: implement
  throw new Error("NotImplementedError");
}
