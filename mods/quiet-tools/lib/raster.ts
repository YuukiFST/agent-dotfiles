// Raster cell packing for Claude Code, ported from Firstmate's fm-calm-ship-raster.ts
// (MIT, see THIRD_PARTY_NOTICES.md).
//
// A `Raster` element's `cells` prop is base64 of `columns * rows` little-endian u32
// triplets `[codePoint, foreground, background]`; `$.ui.blit` repaints a mounted Raster
// with a new `cells` string without a render pass.

/** Claude Code's Raster width limit, per RasterProps. */
export const RASTER_MAX_COLUMNS = 512;

/** The transcript's side margin the stock working row also sits inside. */
export const RASTER_MARGIN = 2;

/** The viewport width assumed before the surface has measured. */
export const RASTER_DEFAULT_VIEWPORT_COLUMNS = 80;

/** `0x01000000` (bit 24 alone) asks for the terminal's default color. */
export const RASTER_DEFAULT_COLOR = 0x01000000;

/** How many Raster columns a Spinner site of `viewportColumns` gets: the row minus its margin, within the Raster's limits. */
export function rasterColumns(viewportColumns: number | undefined): number {
  const measured = viewportColumns ?? RASTER_DEFAULT_VIEWPORT_COLUMNS;
  return Math.max(1, Math.min(RASTER_MAX_COLUMNS, measured - RASTER_MARGIN));
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Standard padded base64, written here because the hooks environment and Node differ on native helpers. */
export function encodeBase64(bytes: Uint8Array): string {
  let out = "";
  let index = 0;
  for (; index + 2 < bytes.length; index += 3) {
    const word = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    out +=
      BASE64_ALPHABET[(word >> 18) & 63]! +
      BASE64_ALPHABET[(word >> 12) & 63]! +
      BASE64_ALPHABET[(word >> 6) & 63]! +
      BASE64_ALPHABET[word & 63]!;
  }
  const rest = bytes.length - index;
  if (rest === 1) {
    const word = (bytes[index] ?? 0) << 16;
    out += BASE64_ALPHABET[(word >> 18) & 63]! + BASE64_ALPHABET[(word >> 12) & 63]! + "==";
  } else if (rest === 2) {
    const word = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8);
    out +=
      BASE64_ALPHABET[(word >> 18) & 63]! +
      BASE64_ALPHABET[(word >> 12) & 63]! +
      BASE64_ALPHABET[(word >> 6) & 63]! +
      "=";
  }
  return out;
}
