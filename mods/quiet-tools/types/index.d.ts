export type Calls = number

// Footer lines per turn, keyed by the turn's durationMs as TurnDuration reports it.
export type Footers = Record<string, readonly string[]>

// Answers of main-loop steps that also called tools, newest last.
export type Narrations = readonly string[]

// Final answers of main-loop turns, newest last; a block found here is never hidden as narration.
export type Answers = readonly string[]

declare module 'claude-code' {
  interface PluginState {
    'quiet-tools': { calls: Calls; footers: Footers; narrations: Narrations; answers: Answers }
  }
}
