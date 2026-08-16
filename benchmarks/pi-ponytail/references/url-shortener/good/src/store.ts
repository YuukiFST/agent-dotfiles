export interface UrlStore {
  save(code: string, url: string): void;
  get(code: string): string | undefined;
  hasUrl(url: string): boolean;
  getCodeForUrl(url: string): string | undefined;
}

export function createUrlStore(): UrlStore {
  const codeToUrl = new Map<string, string>();
  const urlToCode = new Map<string, string>();

  return {
    save(code: string, url: string) {
      codeToUrl.set(code, url);
      urlToCode.set(url, code);
    },
    get(code: string) {
      return codeToUrl.get(code);
    },
    hasUrl(url: string) {
      return urlToCode.has(url);
    },
    getCodeForUrl(url: string) {
      return urlToCode.get(url);
    },
  };
}
