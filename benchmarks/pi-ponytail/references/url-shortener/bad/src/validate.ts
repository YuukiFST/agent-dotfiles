export function isValidUrl(url: string): boolean {
  // Bad: only checks non-empty, no scheme validation
  return !!url && url.trim().length > 0;
}
