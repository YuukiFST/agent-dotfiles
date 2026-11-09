// The black-hole working art: the generated dot map in the photo's colors, centered in
// the Spinner row, with two bright lobes sweeping around the hole so the disk turns.
import {
  BLACK_HOLE_CENTER,
  BLACK_HOLE_COLORS,
  BLACK_HOLE_COLUMNS,
  BLACK_HOLE_GLYPHS,
} from "./black-hole-art";
import { encodeBase64, RASTER_DEFAULT_COLOR } from "./raster";

/** The Raster's `key` inside the Spinner drawing, what `$.ui.blit` names to repaint it. */
export const BLACK_HOLE_RASTER_KEY = "quiet-tools-black-hole";

/** How often the shimmer advances one step. */
export const BLACK_HOLE_TICK_MS = 220;

/** Ticks for the shimmer to sweep one full turn around the hole (about 7 s). */
export const BLACK_HOLE_TICKS_PER_TURN = 32;

export const BLACK_HOLE_ROWS = BLACK_HOLE_GLYPHS.length;

/** The darkest a cell gets as the shimmer passes, as a share of its photo color. */
const SHIMMER_FLOOR = 0.6;

/**
 * A cell's brightness factor at `tick`, from SHIMMER_FLOOR to 1. Rows count double in
 * the angle because a terminal cell is about twice as tall as it is wide.
 */
export function blackHoleBrightness(row: number, column: number, tick: number): number {
  const angle = Math.atan2((row - BLACK_HOLE_CENTER.row) * 2, column - BLACK_HOLE_CENTER.column);
  const phase = (tick / BLACK_HOLE_TICKS_PER_TURN) * 2 * Math.PI;
  const wave = 0.5 + 0.5 * Math.cos(2 * angle - phase);
  return SHIMMER_FLOOR + (1 - SHIMMER_FLOOR) * wave;
}

function scaleColor(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

export type BlackHoleCells = {
  rows: number;
  /** The packed `cells` string for a Raster of `columns` by `rows`. */
  cells: string;
};

/**
 * Pack the art for a Raster `columns` wide at `tick`: centered, padded with default
 * spaces, and cropped evenly on both sides when the row is narrower than the art.
 */
export function packBlackHoleCells(columns: number, tick: number): BlackHoleCells {
  const rows = BLACK_HOLE_ROWS;
  const offset = Math.floor((columns - BLACK_HOLE_COLUMNS) / 2);
  const words = new Uint32Array(columns * rows * 3);
  for (let row = 0; row < rows; row += 1) {
    const glyphs = BLACK_HOLE_GLYPHS[row] ?? "";
    const colors = BLACK_HOLE_COLORS[row] ?? [];
    for (let column = 0; column < columns; column += 1) {
      const artColumn = column - offset;
      const glyph = glyphs[artColumn] ?? " ";
      const color = colors[artColumn] ?? 0;
      const cell = (row * columns + column) * 3;
      const blank = glyph === " " || color === 0;
      words[cell] = blank ? 0x20 : glyph.codePointAt(0)!;
      words[cell + 1] = blank ? RASTER_DEFAULT_COLOR : scaleColor(color, blackHoleBrightness(row, artColumn, tick));
      words[cell + 2] = RASTER_DEFAULT_COLOR;
    }
  }
  return { rows, cells: encodeBase64(new Uint8Array(words.buffer)) };
}
