// Turns a page of the ai-memory web dashboard (/web/...) into what the panel draws: HTML
// that TextView can show, cut around the parts that need to act (the tab list, forms, the
// message composer, inbox messages), which the panel draws natively instead.
// Pure: no host calls, so `node` can run it against saved pages.

export const ORIGIN = "http://127.0.0.1:49374";
export const WEB = `${ORIGIN}/web/`;

const VOID = new Set("area base br col embed hr img input link meta source track wbr".split(" "));
const ATTR = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", hellip: "…", rarr: "→", larr: "←", mdash: "—", ndash: "–", times: "×", copy: "©" };

export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function attrsOf(text) {
  const attrs = {};
  for (const m of (text ?? "").matchAll(ATTR)) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}

const NAME_CHAR = /[\w-]/;

// Index of the `>` closing the tag that starts at `from`, skipping quoted attribute values.
function tagEnd(html, from) {
  let quote = null;
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (quote) { if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i;
  }
  return -1;
}

// Every tag in the text, in order: { close, tag, attrs, start, end }. Scanned by hand:
// Herdr's regex engine aborts the task on whole-page backtracking patterns.
function tokens(html) {
  const out = [];
  let i = html.indexOf("<");
  while (i >= 0) {
    if (html.startsWith("<!--", i)) {
      const close = html.indexOf("-->", i + 4);
      if (close < 0) break;
      i = html.indexOf("<", close + 3);
      continue;
    }
    const close = html[i + 1] === "/";
    let j = i + (close ? 2 : 1);
    const nameStart = j;
    while (j < html.length && NAME_CHAR.test(html[j])) j++;
    if (j === nameStart || !/[a-zA-Z]/.test(html[nameStart])) { i = html.indexOf("<", i + 1); continue; }
    const end = tagEnd(html, j);
    if (end < 0) break;
    const inside = html.slice(j, end);
    out.push({ close, tag: html.slice(nameStart, j).toLowerCase(), attrs: close ? {} : attrsOf(inside), selfClosing: inside.trimEnd().endsWith("/"), start: i, end: end + 1 });
    i = html.indexOf("<", end + 1);
  }
  return out;
}

// Removes every `<tag ...>...</tag>` (case-insensitive), without regex backtracking.
function dropBlocks(html, tag) {
  const lower = html.toLowerCase();
  let out = "";
  let at = 0;
  for (let i = lower.indexOf(`<${tag}`, 0); i >= 0; i = lower.indexOf(`<${tag}`, at)) {
    const next = lower[i + tag.length + 1];
    if (next && NAME_CHAR.test(next)) { out += html.slice(at, i + 1); at = i + 1; continue; }
    const close = lower.indexOf(`</${tag}`, i);
    const end = close < 0 ? html.length : lower.indexOf(">", close) + 1 || html.length;
    out += html.slice(at, i);
    at = end;
  }
  return out + html.slice(at);
}

function dropComments(html) {
  let out = "";
  let at = 0;
  for (let i = html.indexOf("<!--"); i >= 0; i = html.indexOf("<!--", at)) {
    const close = html.indexOf("-->", i + 4);
    out += html.slice(at, i);
    at = close < 0 ? html.length : close + 3;
  }
  return out + html.slice(at);
}

// The text between the end of `<tag ...>` and the last `</tag>`, or null.
function innerOf(html, tag) {
  const lower = html.toLowerCase();
  const open = lower.indexOf(`<${tag}`);
  const close = lower.lastIndexOf(`</${tag}`);
  if (open < 0 || close < 0) return null;
  const start = lower.indexOf(">", open) + 1;
  return start > 0 && start <= close ? html.slice(start, close) : null;
}

// Where the element opened by toks[i] ends (the index just past its closing tag).
function endOf(toks, i, html) {
  const open = toks[i];
  if (VOID.has(open.tag) || open.selfClosing) return open.end;
  let depth = 0;
  for (let j = i; j < toks.length; j++) {
    const t = toks[j];
    if (t.tag !== open.tag) continue;
    depth += t.close ? -1 : 1;
    if (depth === 0) return t.end;
  }
  return html.length;
}

// The outermost elements whose opening tag passes `test`: { start, end, tag, attrs, html, inner }.
export function find(html, test) {
  const toks = tokens(html);
  const found = [];
  let after = -1;
  toks.forEach((t, i) => {
    if (t.close || t.start < after || !test(t)) return;
    const end = endOf(toks, i, html);
    found.push({ start: t.start, end, tag: t.tag, attrs: t.attrs, html: html.slice(t.start, end), inner: html.slice(t.end, Math.max(t.end, end - t.tag.length - 3)) });
    after = end;
  });
  return found;
}

// Swaps each element `find` returns for what `replace` gives (null drops it).
function rewrite(html, test, replace) {
  let out = "";
  let at = 0;
  for (const el of find(html, test)) {
    out += html.slice(at, el.start) + (replace(el) ?? "");
    at = el.end;
  }
  return out + html.slice(at);
}

export const textOf = (html) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const hasClass = (t, c) => (t.attrs.class ?? "").split(/\s+/).includes(c);

// A path under /web/ for an href on a page whose base is /web/ ("inbox?x", "../", "/web/y").
export function webPath(href) {
  if (!href) return null;
  let h = href.trim();
  if (h.startsWith(WEB)) h = h.slice(WEB.length);
  else if (h.startsWith(ORIGIN)) h = h.slice(ORIGIN.length);
  if (/^[a-z][\w+.-]*:/i.test(h) || h.startsWith("#")) return null;
  if (h.startsWith("/")) return h.startsWith("/web/") ? h.slice(5) : h === "/web" ? "" : null;
  h = h.replace(/#.*$/, "");
  if (h === "." || h === "./") return "";
  return h.replace(/^\.\//, "");
}

export const queryParam = (path, name) => {
  const m = new RegExp(`[?&]${name}=([^&#]*)`).exec(path ?? "");
  return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
};

function parseForm(el, index) {
  const html = el.html;
  const labels = {};
  const wrapped = {}; // control name -> text of the <label> around it
  for (const l of find(html, (t) => t.tag === "label")) {
    if (l.attrs.for) labels[l.attrs.for] = textOf(l.inner.replace(/<span[\s\S]*?<\/span>/gi, ""));
    const control = find(l.inner, (t) => t.tag === "input" || t.tag === "select" || t.tag === "textarea")[0];
    if (!l.attrs.for && control?.attrs.name) wrapped[control.attrs.name] = textOf(l.inner.replace(control.html, ""));
  }
  const fields = [];
  for (const f of find(html, (t) => t.tag === "input" || t.tag === "select" || t.tag === "textarea")) {
    const type = f.tag === "input" ? (f.attrs.type ?? "text").toLowerCase() : f.tag;
    if (type === "submit" || type === "button" || type === "image" || type === "reset") continue;
    const field = { type, name: f.attrs.name ?? "", id: f.attrs.id ?? "", label: labels[f.attrs.id] ?? wrapped[f.attrs.name] ?? f.attrs["aria-label"] ?? f.attrs.placeholder ?? f.attrs.name ?? "", value: f.attrs.value ?? "" };
    if (type === "select") {
      field.options = find(f.inner, (t) => t.tag === "option").map((o) => ({ value: o.attrs.value ?? textOf(o.inner), label: textOf(o.inner), selected: "selected" in o.attrs, data: o.attrs }));
      const chosen = field.options.find((o) => o.selected) ?? field.options[0];
      field.value = chosen?.value ?? "";
    }
    if (type === "textarea") field.value = decode(f.inner);
    if (type === "checkbox" || type === "radio") field.checked = "checked" in f.attrs;
    fields.push(field);
  }
  const submit = find(html, (t) => t.tag === "button" && (t.attrs.type ?? "submit") === "submit")[0];
  return { index, id: el.attrs.id ?? "", action: el.attrs.action ?? "", method: (el.attrs.method ?? "get").toLowerCase(), fields, submit: submit ? textOf(submit.inner) : null };
}

function parseMail(el) {
  const summary = find(el.html, (t) => t.tag === "summary")[0];
  const pill = find(summary?.html ?? "", (t) => hasClass(t, "status-pill"))[0];
  const preview = find(summary?.html ?? "", (t) => hasClass(t, "mail-preview"))[0];
  const parts = preview ? find(preview.inner, (t) => ["strong", "span", "small"].includes(t.tag)).map((p) => textOf(p.inner)) : [];
  const body = find(el.html, (t) => hasClass(t, "message-body"))[0];
  return {
    id: el.attrs["data-message-id"],
    state: el.attrs["data-state"] ?? "",
    subject: el.attrs["data-subject"] ?? parts[0] ?? "",
    route: parts[1] ?? "",
    meta: parts[2] ?? "",
    status: pill ? textOf(pill.inner) : "",
    body: body ? decode(body.inner.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")).trim() : "",
    actions: find(el.html, (t) => t.tag === "button" && t.attrs["data-message-action"]).map((b) => ({ action: b.attrs["data-message-action"], label: textOf(b.inner) })),
  };
}

// The composer's choices: projects (from / to) and the agents registered in each project.
function parseComposer(main) {
  const options = (id) => {
    const sel = find(main, (t) => t.tag === "select" && t.attrs.id === id)[0];
    return sel ? find(sel.inner, (t) => t.tag === "option").map((o) => ({ workspace: o.attrs["data-workspace"], project: o.attrs["data-project"], selected: "selected" in o.attrs, label: textOf(o.inner) })) : [];
  };
  const tpl = find(main, (t) => t.tag === "template" && t.attrs.id === "message-agent-options")[0];
  const agents = tpl ? find(tpl.inner, (t) => t.tag === "option").map((o) => ({ workspace: o.attrs["data-workspace"], project: o.attrs["data-project"], agent: o.attrs["data-agent"], label: textOf(o.inner) })) : [];
  return { from: options("message-from"), to: options("message-to-project"), agents };
}

// The mailbox the inbox page shows (its project picker's selected option).
function parseMailScope(main) {
  const sel = find(main, (t) => t.tag === "select" && t.attrs.id === "mail-project")[0];
  const opt = sel && (find(sel.inner, (t) => t.tag === "option" && "selected" in t.attrs)[0] ?? find(sel.inner, (t) => t.tag === "option")[0]);
  return opt ? { workspace: opt.attrs["data-workspace"], project: opt.attrs["data-project"] } : null;
}

function parseTabs(el, path) {
  const tabs = find(el.inner, (t) => t.tag === "a").map((a) => ({ path: webPath(a.attrs.href), label: textOf(a.inner), panel: a.attrs["aria-controls"] ?? null, key: queryParam(a.attrs.href, "tab"), selected: a.attrs["aria-selected"] === "true" || a.attrs["aria-current"] === "page" }));
  const want = queryParam(path, "tab");
  if (want && tabs.some((t) => t.key === want)) tabs.forEach((t) => (t.selected = t.key === want));
  return tabs;
}

// Makes TextView-friendly HTML: links absolute, details open, inert controls gone.
function tidy(html) {
  let out = html
    .replace(/<\/?(details|summary)\b[^>]*>/gi, (m, tag) => (tag.toLowerCase() === "summary" ? (m[1] === "/" ? "</strong></p>" : "<p><strong>") : m[1] === "/" ? "</div>" : "<div>"))
    .replace(/\shref="([^"]*)"/gi, (m, href) => {
      const p = webPath(decode(href));
      return p === null ? m : ` href="${escapeHtml(WEB + p)}"`;
    });
  // Without CSS, "<span>Sessions</span><strong>10</strong>" would read "Sessions10".
  out = out.replace(/(<\/(?:span|strong|small|a|code|time|em|b|i|label)>)(?=<(?!\/))/gi, "$1 ");
  // A <dl> term and its value share one line: "accepted 2886".
  out = out.replace(/<dt\b[^>]*>/gi, "<p><strong>").replace(/<\/dt>/gi, "</strong> ").replace(/<dd\b[^>]*>/gi, "<span>").replace(/<\/dd>/gi, "</span></p>");
  out = rewrite(out, (t) => ["button", "select", "input", "textarea", "img"].includes(t.tag) || t.attrs["aria-hidden"] === "true", () => "");
  return out;
}

// { title, mailScope, segments: [{ kind: "html", html } | { kind: "tabs", tabs } | { kind: "form", form }
//   | { kind: "composer", composer } | { kind: "mail", mail }] }
// `pause` hands control back between passes: Herdr ends a script task that runs about half a
// second without yielding, and a 100 KB page takes longer than that.
export async function prepare(page, path, pause = async () => {}) {
  const title = textOf(innerOf(page, "title") ?? "").replace(/\s*[·|–—-]\s*ai-memory.*$/i, "");
  let main = innerOf(page, "main") ?? innerOf(page, "body") ?? page;
  main = ["script", "style", "noscript", "svg"].reduce(dropBlocks, dropComments(main));
  const composer = /id="message-composer"/.test(main) ? parseComposer(main) : null;
  const mailScope = parseMailScope(main);
  main = dropBlocks(main, "template");
  await pause();

  // Only the chosen tab's panel; the others (and anything else hidden) go.
  const tabList = find(main, (t) => t.attrs.role === "tablist")[0];
  const tabs = tabList ? parseTabs(tabList, path) : null;
  const panel = tabs?.find((t) => t.selected)?.panel;
  await pause();
  if (panel) main = rewrite(main, (t) => t.attrs.role === "tabpanel", (el) => (el.attrs.id === panel ? el.html.replace(/^(<[^>]*?)\shidden(?:="[^"]*")?/, "$1") : null));
  await pause();
  main = rewrite(main, (t) => "hidden" in t.attrs && t.tag !== "input", () => null);
  await pause();

  // Cut around the parts drawn natively, in document order.
  const special = [];
  let formIndex = 0;
  main = rewrite(main, (t) => t.attrs.role === "tablist" || t.tag === "form" || (t.tag === "details" && t.attrs["data-message-id"]), (el) => {
    if (el.attrs.role === "tablist") special.push({ kind: "tabs", tabs });
    else if (el.tag === "details") special.push({ kind: "mail", mail: parseMail(el) });
    else if (el.attrs.id === "message-composer") special.push({ kind: "composer", composer });
    else if (/topbar-search/.test(el.attrs.class ?? "")) return "";
    else special.push({ kind: "form", form: parseForm(el, formIndex++) });
    return `\u0000${special.length - 1}\u0000`;
  });
  const segments = [];
  const pieces = main.split(/\u0000(\d+)\u0000/);
  for (let i = 0; i < pieces.length; i++) {
    if (i % 2) segments.push(special[Number(pieces[i])]);
    else if (textOf(pieces[i])) {
      await pause();
      segments.push({ kind: "html", html: tidy(pieces[i]) });
    }
  }
  return { title, mailScope, segments };
}
