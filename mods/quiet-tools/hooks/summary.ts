export type Kind = 'command' | 'edit' | 'read' | 'tool'

export type Counts = Record<Kind, number>

export const emptyCounts = (): Counts => ({ command: 0, edit: 0, read: 0, tool: 0 })

const KIND: Record<string, Kind> = {
  Bash: 'command',
  PowerShell: 'command',
  Edit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
  Read: 'read',
}

export const kindOf = (tool: string): Kind => KIND[tool] ?? 'tool'

// Footer order: commands, edits, reads, tools.
const ORDER: ReadonlyArray<Kind> = ['command', 'edit', 'read', 'tool']

export type TurnStats = {
  counts: Counts
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export const countLabel = (n: number) => plural(n, 'tool call')

// "claude-opus-5-5" -> "Opus 5.5"; anything else is shown as the API named it.
export const modelLabel = (id: string) => {
  const match = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(id)

  return match ? `${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2]}.${match[3]}` : id
}

export const summarize = (s: TurnStats) => {
  const seconds = s.durationMs / 1000
  const counts = ORDER.filter(kind => s.counts[kind] > 0).map(kind => plural(s.counts[kind], kind))
  const footer = [
    s.model && modelLabel(s.model),
    `${seconds.toFixed(1)}s`,
    s.outputTokens > 0 && seconds > 0 && `${(s.outputTokens / seconds).toFixed(1)} tok/s`,
    REASON[s.reason],
  ].filter(Boolean)
  return counts.length > 0 ? [`+ ${counts.join(', ')}`, footer.join(' · ')] : [footer.join(' · ')]
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
