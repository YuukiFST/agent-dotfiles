// For a sessions window without the `companion` mod (props { followFocus: true }): shows the
// agent another window's board asks for, in the side-by-side view when it's marked there.
import { appHome, home, readTextFile, run, watchFolder } from "herdr";
import { sideList, showView } from "./side.js";

const SHARED_DIR = () => `${home()}/.config/herdr-app-shared`;
// A request older than this when it's read was meant for an earlier session.
const FRESH_MS = 10000;

export function followFocusRequests(cx) {
  let handledAt = Date.now();
  cx.spawn(async () => {
    for (;;) {
      await watchFolder(SHARED_DIR());
      let request;
      try {
        request = JSON.parse((await readTextFile(`${SHARED_DIR()}/focus-request.json`)) ?? "null");
      } catch {
        continue; // Half written: the next change event reads it whole.
      }
      if (!request?.terminal || request.from === appHome() || !(request.at > handledAt)) continue;
      handledAt = request.at;
      if (Date.now() - request.at > FRESH_MS) continue;
      const marked = sideList().includes(request.terminal);
      showView(marked ? "side" : "main");
      run(marked ? "pane.focus" : "agent.focus", { terminal: request.terminal });
    }
  });
}
