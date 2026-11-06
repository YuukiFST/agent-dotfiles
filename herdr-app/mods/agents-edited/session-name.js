// The name the person gave this session (mods/session-rename), if any.
import { terminals } from "herdr";

export const chosenSessionName = (address) => terminals().find((k) => k.address === address)?.labels?.["herdr.session-name"];
