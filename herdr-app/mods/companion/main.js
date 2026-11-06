import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, focused, spaces, home, appHome, theme, readTextFile, writeTextFile, watchFolder, run } from "herdr";

// With two screens, a second Herdr app with its own home shows another workspace.
const SECOND_HOME = () => `${home()}\\.config\\herdr-app-2`;
const APP_EXE = () => `${home()}\\AppData\\Local\\Programs\\herdr-app\\herdr-app.exe`;
// Where this window says which folder you're working in; the other window's Git graph follows it.
const FOCUS_FILE = () => `${home()}/.config/herdr-app-shared/focus.json`;
// Where the other window's agent board asks this one to show an agent: { terminal, at }.
const FOCUS_REQUEST_FILE = () => `${home()}/.config/herdr-app-shared/focus-request.json`;
// A request older than this when it's read was meant for an earlier session.
const FOCUS_REQUEST_FRESH_MS = 10000;
const CHECK_MS = 30000;
const FOCUS_MS = 1500;

function ps(script) {
  return exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
}

async function monitorCount() {
  const r = await ps("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens.Count");
  return Number(r.stdout.trim()) || 1;
}

export default class Companion extends View {
  init(_props, cx) {
    this.open = null; // null until the first check
    this.starting = false;
    this.published = null;
    this.written = undefined; // the file's text as last read or written, for writeTextFile's check
    this.check(cx, true);
    cx.timer.every(CHECK_MS, (cx) => this.check(cx, false));
    cx.timer.every(FOCUS_MS, (cx) => this.publish(cx));
    this.handledRequestAt = Date.now();
    cx.spawn(async (cx) => {
      for (;;) {
        await watchFolder(`${home()}/.config/herdr-app-shared`);
        await this.followRequest();
      }
    });
  }

  async followRequest() {
    let request;
    try {
      request = JSON.parse((await readTextFile(FOCUS_REQUEST_FILE())) ?? "null");
    } catch {
      return; // Half written: the next change event reads it whole.
    }
    if (!request?.terminal || request.from === appHome() || !(request.at > this.handledRequestAt)) return;
    this.handledRequestAt = request.at;
    if (Date.now() - request.at > FOCUS_REQUEST_FRESH_MS) return;
    run("agent.focus", { terminal: request.terminal });
  }

  check(cx, launch) {
    cx.spawn(async (cx) => {
      const r = await exec("cmd.exe", ["/c", `set HERDR_APP_HOME=${SECOND_HOME()}&& herdr-app status >nul 2>&1`]);
      this.open = r.code === 0;
      // With one screen the second window would cover this one: open it only on a click.
      if (!this.open && launch && (await monitorCount()) > 1) this.launch(cx);
      cx.notify();
    });
  }

  launch(cx) {
    if (this.starting) return;
    this.starting = true;
    cx.notify();
    cx.spawn(async (cx) => {
      await ps(`$env:HERDR_APP_HOME='${SECOND_HOME()}'; Start-Process '${APP_EXE()}'`);
      this.starting = false;
      this.check(cx, false);
    });
  }

  publish(cx) {
    const f = focused();
    const space = spaces().find((s) => s.id === f?.space);
    const cwd = f?.cwd || space?.folder || null;
    if (!cwd || cwd === this.published || space?.machine) return;
    this.published = cwd;
    cx.spawn(async () => {
      const text = JSON.stringify({ cwd, space: space?.name ?? null, at: Date.now() });
      if (this.written === undefined) this.written = await readTextFile(FOCUS_FILE());
      try {
        await writeTextFile(FOCUS_FILE(), text, this.written);
      } catch {
        // Someone else wrote it since: take theirs as the snapshot and write again.
        this.written = await readTextFile(FOCUS_FILE());
        await writeTextFile(FOCUS_FILE(), text, this.written).catch(() => {});
      }
      this.written = text;
    });
  }

  render() {
    const t = theme();
    const second = this.starting ? "Opening…" : this.open === false ? "Open second window" : null;
    return h_flex().id("companion").size_full().px(10).items_center().justify_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(12)
      .when(this.open === false && !this.starting, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover))
        .tooltip("Open the second window").on_click((_e, cx) => this.launch(cx)))
      .when(Boolean(second), (el) => el.child(div().whitespace_nowrap().text_color(t.dim).child(second)));
  }
}
