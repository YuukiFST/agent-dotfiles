# Alignment in Herdr app mods

Every mod in a window sits on one **grid** shared with every other mod in that window, and every row on it is **tight**.
A new mod, or a change to a mod's look, lines up with its neighbours to the pixel, vertically and horizontally, keeps each value beside the label it belongs to, and leaves every shared line it crosses intact.
The finished mod is checked in a screenshot, never from the code alone.

## The grid

The values live in the code of `mods/agents-edited` (`status-board.js`, `usage-panel.js`, `notes/panel.js`, `hardware-panel.js`, `ctxmap/treemap.js`); read them there and reuse them by name.
A mod that needs a different value changes it in every panel that shares the line, in the same edit.

- **Panels:** the window has a 10px inset and an 8px gap between panels (`GAP`); a panel has radius 8 and a 1px border.
- **Inset line:** all content inside a panel starts and ends 12px from its border: headers, rows, inputs, empty states and buttons.
  A child inside an inset container takes only vertical padding, so its text stays on the inset line.
- **First row:** a panel at the top of the window opens with a 30px row with no padding above it and its content centered, the height of the summary strip, so the first rows of all columns share one middle line.
- **Header and rows:** a table's header row uses the same gap and padding as its rows, so every column edge runs straight down.
- **Last row:** panels side by side end with rows that share one middle line.
- **Text at an edge:** a text-only action at a panel's edge takes a negative margin equal to its padding (`mr_neg_1p5()` for `px(6)`), so its glyphs sit on the inset line the way a button's box does.

## Tight rows

A row reads as one unit: a figure, a reason or a control sits one gap (6, 8, 12 or 14px) after the label it belongs to.

- **Elastic fill:** the width a row has left over goes to an element that can use it (a bar, a meter, a text that truncates), so it carries information instead of empty space.
- **Content-sized columns:** a column is as wide as its widest content.
  A figure column fits its widest format (`"100%"` 28px, `"10.0 GB"` 50px in `Geist Mono` 11.5px), right-aligned so the digits line up.
  A name column fits the longest name present, estimated at 7px a glyph of the 12.5px UI font (`hardware-panel.js` `nameColumn`), with a cap and truncation past it.
- **Shared starts:** tables stacked in one panel share their name column, so every reason, bar and figure after the names starts on one line (the Hardware Monitor's "Can I run" and "Top consumers").
- **Proximity first:** when a shared line between panels would push a value away from its label, the value stays by its label; a cross-panel line is kept only where it costs no empty space (the inset line, the first and last rows, the row's last figure ending on the inset line).

## Proving it

1. Shoot the layout before the change, at the size of the window the person uses: `node tests/shot-layout.mjs <layout> before.png --window <that window's window.json>` from `~/.config/herdr-app`.
   It opens a throwaway window on a copy of the mods and quits it, so the person's windows stay as they are; pass `--settle 50000` when the Hardware Monitor must fill in.
2. Make the change, then shoot `after.png` the same way, once per state the mod can show (each mode of a switcher, empty and full, the longest name and the shortest).
3. Measure in both shots with `node tests/ink.mjs after.png <name>=<x0>,<y0>,<x1>,<y1> ...`, which prints each region's ink box (`--threshold 40` catches dim borders):
   the middles of the first and last rows, the left edges on each inset line, the start of each shared column, and the run between each label and its value.
4. Done when every shared line agrees within 1px across all the panels it crosses, and every label-to-value run is one gap plus at most a right-aligned figure's slack; the report gives the before and after numbers.
   A part the throwaway window cannot render (a panel still measuring, an empty list) is reported as not verified, by name.
