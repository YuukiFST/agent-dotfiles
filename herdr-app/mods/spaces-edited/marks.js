// How a space looks in the list: its avatar color and the glyph for its status.

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.
export const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

// A project's avatar color, the same for the same repo or folder wherever it shows.
export function projectColor(name) {
  const colors = Object.values(MARK);
  let h = 0;
  for (const ch of String(name ?? "").toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return colors[h % colors.length];
}

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" ? "!" : status === "done" ? "●" : "·";
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}
