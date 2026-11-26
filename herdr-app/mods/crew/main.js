// The orchestrator's crewmates and the decisions waiting for the person: the sidebar's
// Orchestration tab, with { "only": "tabs" } the Sessions | Orchestration switch above it, with
// { "only": "count" } a footer block. Crewmates run in their own herdr-core session, out of
// agents(); this mod runs no process and never calls hc: it reads state/crew.json and
// state/decisions.json and watches the state folder.
// With { "report": <path> } it is the dialog that shows one crewmate's report.md.
// Its copies take the commands crew.toggle-needs, crew.toggle-running and crew.toggle-finished.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { agents, checking, closeOverlay, home, layout, nextCommand, openOverlay, props, readTextFile, run, spaces, theme, watchFolder } from "herdr";
import { GROUPS, age, attentionOf, countText, parseDecisions, parseRoster } from "./roster.js";
import { orchestrationPanel, needsOf } from "./orchestration.js";
import { ORCHESTRATION_TAB, SESSIONS_TAB, SIDEBAR_STACK, tabsBlock } from "./tabs.js";
import { orchestratorFolder, orchestratorSpace, startOrchestrator } from "./orchestrator.js";

// The layout leaves both unset; screenshots point them at fixtures.
const crewFile = () => props()?.crewFile ?? `${home()}/Desktop/orchestrator/state/crew.json`;
const decisionsFile = () => props()?.decisionsFile ?? `${home()}/Desktop/orchestrator/state/decisions.json`;
const WATCH_ARGV = ["bash", "-lc", "cd ~/Desktop/orchestrator && bin/crew watch"];
const stateFolder = (file) => file.replaceAll("\\", "/").replace(/\/[^/]*$/, "");
const mode = () => props()?.report ? "report" : props()?.only ?? "panel";
// An agent's status, most urgent first, as Herdr ranks a space's.
const STATUS_RANK = ["blocked", "done", "working", "idle"];
// A watch that cannot start (the folder is not there yet) tries again this much later.
const WATCH_RETRY_MS = 30000;
const OPEN_GROUPS_KEY = "crew.openGroups";
const TOGGLE_COMMAND = /^toggle-(needs|running|finished)$/;

function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}
// The sidebar's rail goes by its width, as agents-edited/rail.js reads it.
const isNarrow = () => (findNode(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

function storedOpenGroups() {
  try {
    const ids = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? "null");
    if (Array.isArray(ids)) return new Set(ids);
  } catch {}
  return new Set(GROUPS.filter((g) => g.isOpenByDefault).map((g) => g.id));
}

export default class Crew extends View {
  init(_props, cx) {
    if (mode() === "report") {
      this.reportText = null;
      cx.spawn(async (cx) => {
        this.reportText = (await readTextFile(props().report).catch(() => null)) ?? "No report.";
        cx.notify();
      });
      return;
    }
    this.roster = { max: null, crew: [] };
    this.rosterText = undefined;
    this.decisions = [];
    this.decisionsText = undefined;
    this.openGroups = storedOpenGroups();
    this.isClosed = false;
    if (checking()) return;
    this.followState(cx);
    if (mode() === "count") return;
    if (mode() === "panel") this.followCommands(cx);
    this.shownClock = this.clockText();
    // Ages and fresh reports move by the minute: redraw only when one shown changes.
    cx.timer.every(60000, (cx) => {
      const shown = this.clockText();
      if (shown === this.shownClock) return;
      this.shownClock = shown;
      cx.notify();
    });
  }

  async close() {
    this.isClosed = true;
    for (const watch of this.watches ?? []) watch.cancel();
  }

  followCommands(cx) {
    cx.spawn(async (cx) => {
      while (!this.isClosed) {
        const match = TOGGLE_COMMAND.exec(await nextCommand());
        if (!match) continue;
        this.toggleGroup(match[1]);
        cx.notify();
      }
    });
  }

  followState(cx) {
    const folders = [...new Set([stateFolder(crewFile()), ...(mode() === "count" ? [] : [stateFolder(decisionsFile())])])];
    cx.spawn(async (cx) => {
      while (!this.isClosed) {
        // Watch first, then read: a change landing in between still wakes the watch.
        try {
          this.watches = folders.map((folder) => watchFolder(folder));
        } catch {
          for (const watch of this.watches ?? []) watch.cancel();
          this.watches = null;
        }
        await this.reload(cx);
        const isWatching = await (this.watches ? Promise.race(this.watches) : Promise.reject()).then(() => true, () => false);
        for (const watch of this.watches ?? []) watch.cancel();
        if (!isWatching && !this.isClosed) await new Promise((resolve) => cx.timer.after(WATCH_RETRY_MS, resolve));
      }
    });
  }

  async reload(cx) {
    const isRosterNew = await this.reloadRoster();
    const isDecisionsNew = mode() !== "count" && await this.reloadDecisions();
    if (!isRosterNew && !isDecisionsNew) return;
    this.shownClock = this.clockText();
    cx.notify();
  }

  async reloadRoster() {
    const text = await readTextFile(crewFile()).catch(() => null);
    if (text === this.rosterText) return false;
    const roster = parseRoster(text);
    // Caught midway through a write: keep the last good list.
    if (!roster) return false;
    this.rosterText = text;
    this.roster = roster;
    return true;
  }

  async reloadDecisions() {
    const text = await readTextFile(decisionsFile()).catch(() => null);
    if (text === this.decisionsText) return false;
    const decisions = parseDecisions(text);
    if (!decisions) return false;
    this.decisionsText = text;
    this.decisions = decisions;
    return true;
  }

  clockText() {
    const now = Date.now();
    return this.roster.crew.map((c) => `${c.spawnedMs === null ? "" : age(now - c.spawnedMs)}${attentionOf(c, now) ?? ""}`).join();
  }

  toggleGroup(id) {
    if (this.openGroups.has(id)) this.openGroups.delete(id);
    else this.openGroups.add(id);
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify([...this.openGroups]));
  }

  openReport(c) {
    if (!c.hasReport) return;
    const file = `${stateFolder(crewFile())}/${c.name}/report.md`;
    openOverlay({ mod: "crew", kind: "dialog", width: 720, height: 560, props: { report: file, title: c.name } });
  }

  watchCrew() {
    run("tab.new", { name: "crew watch", folder: orchestratorFolder(), argv: WATCH_ARGV });
  }

  // The stack's active child is the layout's state: a click, a key and a restart all agree.
  activeTab() {
    return findNode(layout(), SIDEBAR_STACK)?.active === ORCHESTRATION_TAB ? ORCHESTRATION_TAB : SESSIONS_TAB;
  }

  // Orchestration shows the orchestrator's space, started if it is not there; Sessions goes back
  // to the space shown before it, else to the first other space.
  chooseTab(child) {
    const orchestrator = orchestratorSpace();
    if (child === ORCHESTRATION_TAB && orchestrator) run("space.select", { id: orchestrator.id });
    else if (child === ORCHESTRATION_TAB) startOrchestrator();
    else {
      const others = spaces().filter((s) => s.id !== orchestrator?.id);
      const back = others.find((s) => s.id === this.returnSpaceId) ?? others[0];
      if (back) run("space.select", { id: back.id });
    }
    run("layout.select", { stack: SIDEBAR_STACK, child });
  }

  // The tab follows the shown space when it changes by another route (a key, space.next, a row of
  // the Spaces list). It reacts to space changes only and never changes the space itself, so the
  // layout.select it runs cannot start another round.
  followShownSpace() {
    const shown = spaces().find((s) => s.active)?.id ?? null;
    const orchestratorId = orchestratorSpace()?.id ?? null;
    if (shown && shown !== orchestratorId) this.returnSpaceId = shown;
    if (shown === this.shownSpaceId) return;
    this.shownSpaceId = shown;
    if (!shown) return;
    const tab = shown === orchestratorId ? ORCHESTRATION_TAB : SESSIONS_TAB;
    if (this.activeTab() !== tab) run("layout.select", { stack: SIDEBAR_STACK, child: tab });
  }

  // { status } of the orchestrator's most urgent agent, or null when its space is not there.
  orchestratorState() {
    const space = orchestratorSpace();
    if (!space) return null;
    const statuses = agents().filter((a) => a.space === space.id).map((a) => a.status);
    return { status: STATUS_RANK.find((s) => statuses.includes(s)) ?? null };
  }

  reportDialog(t) {
    return v_flex().id("crew-report").size_full().min_h(0).bg(t.popover).text_size(13).text_color(t.foreground)
      .child(h_flex().h(30).flex_none().px(12).items_center().justify_between().border_b(1).border_color(t.border)
        .child(div().text_size(12).font_medium().text_color(t.muted).child(`Report · ${props().title ?? ""}`))
        .child(div().id("crew-report-close").px(6).mr_neg_1p5().rounded(4).text_size(12).text_color(t.dim).cursor_pointer()
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => closeOverlay(props().overlay)).child("Close")))
      .child(v_flex().id("crew-report-body").flex_1().min_h(0).px(12).py(10).overflow_y_scrollbar()
        .child(this.reportText === null ? div().text_color(t.dim).child("Loading…") : TextView.markdown("crew-report-text", this.reportText).selectable(true)));
  }

  countBlock(t) {
    const hasAttention = this.roster.crew.some((c) => attentionOf(c, Date.now()) === "blocked");
    return h_flex().id("crew-count").size_full().px(14).gap(6).items_center().justify_end().bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(12).text_color(t.muted)
      .child(div().text_color(t.dim).child("crew"))
      .child(div().text_color(hasAttention ? t.blocked : t.muted).child(countText(this.roster)));
  }

  render() {
    const t = theme();
    const now = Date.now();
    switch (mode()) {
      case "report":
        return this.reportDialog(t);
      case "count":
        return this.countBlock(t);
      case "tabs":
        if (!checking()) this.followShownSpace();
        return tabsBlock(t, {
          active: this.activeTab(),
          needs: needsOf(t, this.roster, this.decisions, now),
          isNarrow: isNarrow(),
          select: (child) => this.chooseTab(child),
        });
      default:
        return orchestrationPanel(t, {
          roster: this.roster,
          decisions: this.decisions,
          orchestrator: this.orchestratorState(),
          now,
          isNarrow: isNarrow(),
          openGroups: this.openGroups,
          actions: {
            toggleGroup: (id, cx) => { this.toggleGroup(id); cx.notify(); },
            openReport: (c) => this.openReport(c),
            watch: () => this.watchCrew(),
            showOrchestrator: () => this.chooseTab(ORCHESTRATION_TAB),
          },
        });
    }
  }
}
