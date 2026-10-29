export type Calls = number

// Footer lines per turn, keyed by the turn's durationMs as TurnDuration reports it.
export type Footers = Record<string, readonly string[]>

declare module 'claude-code' {
  interface PluginState {
    'quiet-tools': { calls: Calls; footers: Footers }
  }
}
