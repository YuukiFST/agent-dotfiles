// Builds a whole window's layout (layouts/*.json) from the parts picked for a workspace.
// Pure: the caller says which parts this window shows and which mod names its home has.

// What can be placed, in the order the picker lists them. `with`: travels with another part.
export const PARTS = [
  { id: "sessions", label: "Sessions", about: "terminals and agents, with the tab bar and the Files / Changes / Git panel", required: true },
  { id: "spaces", label: "Spaces", about: "the spaces list (sidebar)" },
  { id: "agents", label: "Agents", about: "the agents list (sidebar)" },
  { id: "board", label: "Agent board", about: "a card per agent: what it does, its checkout, its screen" },
  { id: "git", label: "Git graph", about: "the graph of the folder you work in" },
  { id: "memory", label: "AI memory", about: "ai-memory pages and sessions" },
  { id: "status", label: "Status bar", about: "machine, branch, agent count" },
  { id: "watch", label: "Agent watch", about: "agent counts; reminds you of waiting agents" },
  { id: "usage", label: "Claude usage", about: "weekly limit, CPU, RAM, disk, network" },
];

const card = { radius: 10, border: { width: 1, color: "border" } };

function sessionsBlock() {
  return {
    id: "main",
    type: "block",
    content: {
      tab: "active",
      pane: {
        header: { content: { mod: "pane-info" }, reveal: "always", height: 30, position: "top" },
        background: "background",
        border: { width: 1, color: "border" },
        focus: { width: 1, color: "accent" },
        radius: 10,
        gap: 8,
        lone: true,
      },
    },
  };
}

function sidePanel() {
  return {
    id: "panel",
    type: "column",
    size: { px: 368 },
    min: 280,
    max: 900,
    hidden: true,
    children: [{
      id: "panel-body",
      type: "stack",
      active: "files",
      children: [
        { id: "files", type: "block", content: { mod: "files" } },
        { id: "changes", type: "block", content: { mod: "changes" } },
        { id: "graph", type: "block", content: { mod: "git-graph" } },
      ],
    }],
  };
}

// opts: { parts: Set of PARTS ids on this window, mods: { agents, spaces } (this home's
// folder names for the edited lists), followFile: where the sessions window publishes
// its focused folder }.
export function composeLayout({ parts, mods, followFile }) {
  const has = (id) => parts.has(id);
  const sessions = has("sessions");
  const info = [
    has("board") && { id: "board", type: "block", size: { weight: 2 }, min: 320, content: { mod: mods.agents, props: { board: true } }, ...card },
    has("git") && { id: "git", type: "block", size: { weight: 3 }, min: 380, content: { mod: "git-graph", props: sessions ? {} : { follow: followFile } }, ...card },
    has("memory") && { id: "memory", type: "block", size: { weight: 2 }, min: 300, content: { mod: "ai-memory", props: { block: "memory" } }, ...card },
  ].filter(Boolean);

  const lists = [
    has("spaces") && { id: "spaces", type: "block", size: { weight: 1 }, min: 90, content: { mod: mods.spaces } },
    has("agents") && { id: "agents", type: "block", size: { weight: 1 }, min: 90, content: { mod: mods.agents } },
  ].filter(Boolean);
  const sidebar = lists.length && {
    id: "sidebar",
    type: "column",
    size: { px: 240 },
    min: 44,
    max: 480,
    background: "chrome",
    resizable: false,
    children: [
      { id: "brand", type: "block", size: { px: 46 }, window_drag: true, content: { mod: "workspace-chrome" } },
      { id: "sidebar-lists", type: "column", children: lists },
    ],
  };

  const body = sessions
    ? {
        id: "work",
        type: "column",
        resizable: false,
        children: [
          { id: "tabs", type: "block", size: { px: 42 }, window_drag: true, content: { mod: "tabs-graph" } },
          { id: "work-body", type: "row", padding: 6, gap: 6, children: [sessionsBlock(), sidePanel(), ...info] },
        ],
      }
    : info.length && { id: "work", type: "row", padding: 6, gap: 6, background: "canvas", children: info };

  const bar = [
    has("status") && { id: "status", type: "block", size: { weight: 1 }, content: { mod: "workspace-status" } },
    has("watch") && { id: "agent-watch", type: "block", size: { px: 240 }, content: { mod: "agent-watch" } },
    has("usage") && { id: "usage-bar", type: "block", size: has("status") ? { px: 880 } : { weight: 1 }, content: { mod: "claude-usage" } },
    { id: "skills-toggle", type: "block", size: { px: 96 }, content: { mod: "skills", props: { role: "toggle" } } },
    { id: "workspaces", type: "block", size: { px: 170 }, content: { mod: "workspaces" } },
  ].filter(Boolean);
  const footer = { id: "footer", type: "row", size: { px: 28 }, resizable: false, divider: { width: 1, color: "border" }, children: bar };

  const top = [sidebar, body].filter(Boolean);
  const main = top.length > 1
    ? { id: "body", type: "row", divider: { width: 1, color: "border" }, children: top }
    : top[0] ? { ...top[0], size: { weight: 1 }, min: undefined, max: undefined } : { id: "empty", type: "block", content: { mod: "workspace-status" } };
  return {
    id: "root",
    type: "column",
    background: "canvas",
    terminal_padding: [10, 8],
    // The tab bar draws the window buttons; without it the system title bar does.
    ...(sessions ? { titlebar: "none", traffic_lights: [12, 16] } : {}),
    children: [main, footer],
  };
}
