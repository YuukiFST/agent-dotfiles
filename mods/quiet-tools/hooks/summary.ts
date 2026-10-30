export type Kind = 'command' | 'edit' | 'thought' | 'read' | 'tool'

export type Counts = Record<Kind, number>

export const emptyCounts = (): Counts => ({ command: 0, edit: 0, thought: 0, read: 0, tool: 0 })

const KIND: Record<string, Kind> = {
  Bash: 'command',
  PowerShell: 'command',
  Edit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
  Read: 'read',
}

export const kindOf = (tool: string): Kind => KIND[tool] ?? 'tool'

// Segment line order, as OpenCode's low verbosity prints it: commands, edits, thoughts, reads, tools.
const ORDER: ReadonlyArray<Kind> = ['command', 'edit', 'thought', 'read', 'tool']

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export const countLabel = (n: number) => plural(n, 'tool call')

// "+ 5 commands, 2 edits, 8 thoughts, 4 reads"; "⋮" while the segment can still grow.
export const segmentLine = (counts: Readonly<Counts>, isActive: boolean) => {
  const parts = ORDER.filter(kind => counts[kind] > 0).map(kind => plural(counts[kind], kind))

  return `${isActive ? '⋮' : '+'} ${parts.join(', ')}`
}

// The line of the segment one of these calls heads, drawn in place of that call's row; null when none heads one.
export const segmentRow = (
  ids: ReadonlyArray<string | undefined>,
  heads: Readonly<Record<string, string>>,
  segments: Readonly<Record<string, Readonly<Counts>>>,
  active: string | null,
) => {
  const id = ids.find(callId => callId !== undefined && heads[callId] === callId)
  const counts = id === undefined ? undefined : segments[id]

  return id === undefined || counts === undefined ? null : segmentLine(counts, active === id)
}

// "claude-opus-5-5" -> "Opus 5.5"; anything else is shown as the API named it.
export const modelLabel = (id: string) => {
  const [, family, major, minor] = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(id) ?? []

  return family && major && minor ? `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}.${minor}` : id
}

export type TurnStats = {
  model: string
  durationMs: number
  outputTokens: number
  reason: 'answer' | 'aborted' | 'refusal' | 'error'
}

const REASON: Record<TurnStats['reason'], string | null> = {
  answer: null,
  aborted: 'interrupted',
  refusal: 'refused',
  error: 'error',
}

// Counts live in the segment lines; the footer keeps model, time, speed and how the turn ended.
export const summarize = (s: TurnStats) => {
  const seconds = s.durationMs / 1000
  const footer = [
    s.model && modelLabel(s.model),
    `${seconds.toFixed(1)}s`,
    s.outputTokens > 0 && seconds > 0 && `${(s.outputTokens / seconds).toFixed(1)} tok/s`,
    REASON[s.reason],
  ].filter(Boolean)

  return [footer.join(' · ')]
}

const FOOTER_TOLERANCE_MS = 5000

// Exact key first, else the stored turn whose duration is nearest within the tolerance.
export const footerFor = (all: Readonly<Record<string, readonly string[]>>, durationMs: number) => {
  const exact = all[String(durationMs)]

  if (exact !== undefined) {
    return exact
  }

  const nearest = Object.keys(all)
    .map(Number)
    .filter(key => Math.abs(key - durationMs) <= FOOTER_TOLERANCE_MS)
    .sort((a, b) => Math.abs(a - durationMs) - Math.abs(b - durationMs))[0]

  return nearest === undefined ? undefined : all[String(nearest)]
}
