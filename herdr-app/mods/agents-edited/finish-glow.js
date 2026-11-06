// A session in view turns done into idle at once, so its finish would never light up. A turn that
// ends stays "done" for a moment even then; the next turn ends it early.

const GLOW_MS = 60000;

export class FinishGlow {
  constructor() {
    this.lastStatus = {};
    this.finishedAt = {};
  }

  // The list with each just-finished agent shown as done.
  apply(list, now) {
    return list.map((a) => {
      if (a.status === "working") delete this.finishedAt[a.address];
      else if (this.lastStatus[a.address] === "working") this.finishedAt[a.address] = now;
      this.lastStatus[a.address] = a.status;
      const isGlowing = a.status === "idle" && now - (this.finishedAt[a.address] ?? -Infinity) < GLOW_MS;
      return isGlowing ? { ...a, status: "done" } : a;
    });
  }
}
