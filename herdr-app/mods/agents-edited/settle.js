// Puts away (tab.settle) tabs whose agents have all been idle for a while, on this screen.
// Herdr brings a settled tab back when it is shown or when an agent in it needs you.
// shared "agents.settleAfterHours": how long idle first (default 2; 0 turns it off).

import { run, shared } from "herdr";

export const SETTLE_AFTER_KEY = "agents.settleAfterHours";
const HOUR_MS = 3600000;

export function settleQuietTabs(spaceList, now) {
  const hours = Number(shared(SETTLE_AFTER_KEY) ?? 2);
  if (!(hours > 0)) return;
  for (const space of spaceList) {
    for (const tab of space.tabs) {
      const onScreen = space.active && tab.active;
      // status null: no agent in it (a shell tab); changed_at null: no change since start.
      if (onScreen || tab.settled || tab.status !== "idle" || !tab.changed_at) continue;
      if (now - tab.changed_at < hours * HOUR_MS) continue;
      run("tab.settle", { id: tab.id });
    }
  }
}
