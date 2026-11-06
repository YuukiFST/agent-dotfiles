// The name a session goes by in the Spaces list (mods/spaces-edited), and the one the person gave
// it (mods/session-rename), if any.
import { shared, terminals } from "herdr";

export const chosenSessionName = (address) => terminals().find((k) => k.address === address)?.labels?.["herdr.session-name"];

const cleanTitle = (title) => (title ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

// Spaces gives a tab holding several sessions one row per session, and any other tab its space's.
export function spaceListName(a, sharesTab, folder) {
  const chosen = chosenSessionName(a.address);
  if (chosen) return chosen;
  if (!sharesTab) return a.space_name || folder;
  return shared("session.origin")?.[a.address]?.name || cleanTitle(a.title) || folder;
}
