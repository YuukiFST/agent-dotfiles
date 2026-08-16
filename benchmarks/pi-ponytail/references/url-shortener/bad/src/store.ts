export interface UrlStore {
  save(code: string, url: string): void;
  get(code: string): string | undefined;
}

export function createUrlStore(): UrlStore {
  const codeToUrl = new Map<string, string>();
  return {
    save(code: string, url: string) {
      codeToUrl.set(code, url);
    },
    get(code: string) {
      return codeToUrl.get(code);
    },
  };
}
