// JSONC to JSON for the OpenCode config files: drop // and /* */ comments, then commas before
// a closing bracket, both only outside string literals. OpenCode accepts comments in
// opencode.json(c) and cli.json and JSON.stringify keeps none.
export function stripJsonc(src) {
  const indexOrEnd = (s, token, from) => (s.indexOf(token, from) === -1 ? s.length : s.indexOf(token, from));
  const noComments = scan(src, (s, i) => {
    if (s.startsWith("//", i)) return [indexOrEnd(s, "\n", i), ""];
    if (s.startsWith("/*", i)) return [Math.min(indexOrEnd(s, "*/", i) + 2, s.length), ""];
  });
  return scan(noComments, (s, i) => {
    if (s[i] === "," && /^\s*[}\]]/.test(s.slice(i + 1))) return [i + 1, ""];
  });
}

// Copy src, letting skip(src, i) replace a span outside strings: it returns [end, replacement].
function scan(src, skip) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === '"') {
      let end = i + 1;
      while (end < src.length && src[end] !== '"') end += src[end] === "\\" ? 2 : 1;
      out += src.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    const hit = skip(src, i);
    if (hit) {
      out += hit[1];
      i = hit[0];
      continue;
    }
    out += src[i++];
  }
  return out;
}
