import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { countLabel, emptyCounts, kindOf, summarize } from './summary'

const calls = atom({ plugin: 'quiet-tools', key: 'calls' } as const, 0)
const footers = atom({ plugin: 'quiet-tools', key: 'footers' } as const, {})

const MARKDOWN = /\.(md|mdx|markdown)$/i

// Edits to Markdown files keep the engine's row and diff; code edits collapse like any other call.
const touchesMarkdown = (value: unknown, key: 'file_path' | 'filePath') => {
  const path = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined

  return typeof path === 'string' && MARKDOWN.test(path)
}

export const register: Register = on => {
  // Main-loop turn stats; a reload mid-turn starts them over, which only skews that turn's footer.
  let counts = emptyCounts()
  let tools = 0

  on('turn.start', async ($, e, next) => {
    counts = emptyCounts()
    tools = 0
    await update($, calls, () => 0)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      tools += 1
      counts[kindOf(e.tool)] += 1
      await update($, calls, () => tools)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // turn.complete text would show under the plugin names; the footer is drawn in the TurnDuration row instead.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined) {
      const lines = summarize({ counts, model: e.usage?.model ?? '', durationMs: e.durationMs, outputTokens: e.usage?.output_tokens ?? 0, reason: e.reason })
      await update($, footers, all => ({ ...all, [String(e.durationMs)]: lines }))
    }

    return result
  })

  // A successful or running call draws nothing; errors, interruptions and Markdown edits keep the engine's row.
  on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
    if (e.props.isErrored || e.props.isInterrupted || touchesMarkdown(e.props.input, 'file_path')) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on('ui.render', { component: 'ToolResult' }, ($, e, next) => {
    if (e.props.isErrored || touchesMarkdown(e.props.output, 'filePath')) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  // "Read 3 files, ran 2 shell commands" and "Worked for 31s": the footer carries both now.
  on('ui.render', { component: 'ToolGroup' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  // A turn with no stored footer (one before the mod loaded) keeps the engine's line.
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const lines = (await read($, footers))[String(e.props.durationMs)]

    if (lines === undefined) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {lines.map(line => (
          <Text dimColor>{line}</Text>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolProgress' }, ($, e, next) =>
    next({ ...e, props: { ...e.props, hint: '' } }),
  )

  // Replaces the whole spinner line (word, elapsed time, tokens, effort) with the call count; a state message such as compacting still shows.
  on('ui.render', { component: 'Spinner' }, async ($, e) => {
    const n = await read($, calls)
    const { Text } = $.ui.resolve(e)

    return (
      <Text dimColor>
        {e.props.message === null ? countLabel(n) : `${e.props.message} · ${countLabel(n)}`}
        {e.props.suffix}
      </Text>
    )
  })
}
