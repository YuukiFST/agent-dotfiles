// quiet-tools under `claude plugin test`: the black-hole art that replaces the stock
// working row while Calm is on, its shimmer on the mocked clock, and its size against
// the viewport.
import { describe, expect, test } from "claude-code/testing";
import { BLACK_HOLE_COLUMNS, BLACK_HOLE_GLYPHS } from "../lib/black-hole-art";
import { boxOf, calmCommand, decodeCells, isStock, rasterOf, spinner, unmeasuredSpinner, world } from "./support";

const DEFAULT = 0x01000000;
const TICK = 220;
const ROWS = BLACK_HOLE_GLYPHS.length;
const sessionStart = { cwd: "/work", surface: "terminal" as const, isInteractive: true };

/** The art's rows as the raster shows them, centered in `columns`. */
function centered(columns: number): string[] {
  const left = Math.floor((columns - BLACK_HOLE_COLUMNS) / 2);
  return BLACK_HOLE_GLYPHS.map((row) => (" ".repeat(left) + row).padEnd(columns, " "));
}

describe("the black-hole art", () => {
  test("replaces the spinner with the art, centered in the row inside the transcript margin", async ($, on) => {
    world(on, { calm: true });
    const raster = rasterOf(await $.ui.render(spinner("agent-main", { columns: 80, rows: 24 })));
    expect(raster).toBeDefined();
    expect(raster!.key).toBe("quiet-tools-black-hole");
    expect(raster!.columns).toBe(78);
    expect(raster!.rows).toBe(ROWS);
    const { glyphs, foregrounds, backgrounds } = decodeCells(raster!.cells, 78, ROWS);
    expect(glyphs).toEqual(centered(78));
    // Every glyph carries a photo color; every blank cell and every background is the default.
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < 78; column += 1) {
        const blank = glyphs[row]![column] === " ";
        expect(foregrounds[row]![column] === DEFAULT, `row ${row} column ${column}`).toBe(blank);
      }
    }
    expect(backgrounds.flat().every((color) => color === DEFAULT)).toBe(true);
  });

  test("leaves one blank row above the art so it stays off the highlighted prompt", async ($, on) => {
    world(on, { calm: true });
    const wrapper = boxOf(await $.ui.render(spinner()));
    expect(wrapper?.props?.paddingTop).toBe(1);
  });

  test("shimmers every tick through blits of the mounted size, keeping the same glyphs", async ($, on) => {
    const { clock, journal } = world(on, { calm: true });
    await $.session.start(sessionStart);
    const raster = rasterOf(await $.ui.render(spinner("agent-main", { columns: 80, rows: 24 })))!;
    const first = decodeCells(raster.cells, 78, ROWS);
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(1);
    expect(journal.blits[0]).toMatchObject({ requestId: "agent-main", key: "quiet-tools-black-hole", columns: 78, rows: ROWS });
    const next = decodeCells(journal.blits[0]!.cells, 78, ROWS);
    expect(next.glyphs).toEqual(first.glyphs);
    expect(next.foregrounds).not.toEqual(first.foregrounds);
  });

  test("stops blitting a site the surface denies and resumes when the spinner is drawn again", async ($, on) => {
    const { clock, journal, denyBlits } = world(on, { calm: true });
    await $.session.start(sessionStart);
    await $.ui.render(spinner());
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(1);
    denyBlits("nothing of quiet-tools is mounted there");
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(2);
    await clock.advance(TICK * 5);
    expect(journal.blits).toHaveLength(2);
    denyBlits(undefined);
    await $.ui.render(spinner());
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(3);
  });

  test("never blits while off, and drops every site when toggled off", async ($, on) => {
    const { clock, journal } = world(on, { calm: true });
    await $.session.start(sessionStart);
    await $.ui.render(spinner());
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(1);
    await $.command.run(calmCommand());
    await clock.advance(TICK * 4);
    expect(journal.blits).toHaveLength(1);
    expect(isStock(await $.ui.render(spinner()))).toBe(true);
    await clock.advance(TICK * 4);
    expect(journal.blits).toHaveLength(1);
  });

  test("sizes to the raster limits and crops a narrow row evenly on both sides", async ($, on) => {
    world(on, { calm: true });
    expect(rasterOf(await $.ui.render(unmeasuredSpinner("a")))!.columns).toBe(78);
    expect(rasterOf(await $.ui.render(spinner("b", { columns: 900, rows: 40 })))!.columns).toBe(512);
    const narrow = rasterOf(await $.ui.render(spinner("c", { columns: 32, rows: 40 })))!;
    expect(narrow.columns).toBe(30);
    const left = Math.ceil((BLACK_HOLE_COLUMNS - 30) / 2);
    expect(decodeCells(narrow.cells, 30, ROWS).glyphs).toEqual(BLACK_HOLE_GLYPHS.map((row) => row.slice(left, left + 30)));
  });

  test("leaves a non-terminal surface to the engine", async ($, on) => {
    const { clock, journal } = world(on, { calm: true });
    const desktop = { ...spinner(), surface: "desktop" as const };
    expect(isStock(await $.ui.render(desktop as never))).toBe(true);
    await clock.advance(TICK * 4);
    expect(journal.blits).toHaveLength(0);
  });
});
