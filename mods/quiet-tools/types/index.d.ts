export type Calls = number

// Footer lines per turn, keyed by the turn's durationMs as TurnDuration reports it.
export type Footers = Record<string, readonly string[]>

// What one segment (the tools and thinking between two texts) ran, keyed by its first tool_use_id.
export type Segments = Record<string, Readonly<Record<'command' | 'edit' | 'thought' | 'read' | 'tool', number>>>

// Each main-loop tool_use_id to the first tool_use_id of its segment, where the segment line draws.
export type Heads = Record<string, string>

// The segment of the running turn that can still grow; null between turns.
export type Active = string | null

declare module 'claude-code' {
  interface PluginState {
    'quiet-tools': { calls: Calls; footers: Footers; segments: Segments; heads: Heads; active: Active }
  }
}
