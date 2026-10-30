import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { isQuietNotification } from './narration'
import { countLabel, emptyCounts, footerFor, kindOf, segmentRow, summarize } from './summary'

const calls = atom({ plugin: 'quiet-tools', key: 'calls' } as const, 0)
const footers = atom({ plugin: 'quiet-tools', key: 'footers' } as const, {})
const segments = atom({ plugin: 'quiet-tools', key: 'segments' } as const, {})
const heads = atom({ plugin: 'quiet-tools', key: 'heads' } as const, {})
const active = atom({ plugin: 'quiet-tools', key: 'active' } as const, null)

export const register: Register = on => {
  // Main-loop turn state; a reload mid-turn starts it over, so that turn's next call opens a new segment.
  let tools = 0
  let head: string | null = null
  let opensSegment = true
  let pendingThoughts = 0

  on('turn.start', async ($, e, next) => {
    tools = 0
    head = null
    opensSegment = true
    pendingThoughts = 0
    await update($, calls, () => 0)
    await update($, active, () => null)

    return next(e)
  }).catch(($, e, next) => next(e))

  // A step's text closes the segment before it; its first tool call opens the next one.
  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      tools += 1

      if (opensSegment || head === null) {
        head = e.tool_use_id
        opensSegment = false
        const thoughts = pendingThoughts
        pendingThoughts = 0
        const id = head
        await update($, segments, all => ({ ...all, [id]: { ...emptyCounts(), thought: thoughts } }))
        await update($, active, () => id)
      }

      const id = head
      const kind = kindOf(e.tool)
      await update($, heads, all => ({ ...all, [e.tool_use_id]: id }))
      await update($, segments, all => ({ ...all, [id]: { ...emptyCounts(), ...all[id], [kind]: (all[id]?.[kind] ?? 0) + 1 } }))
      await update($, calls, () => tools)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Forwards the stream untouched, counting thinking blocks; thinking joins the open segment, or the next one
  // when the turn has none yet.
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    const thinking = new Set<number>()
    let chunk = await stream.next()

    while (chunk.done !== true) {
      if (chunk.value.kind === 'thinking') {
        thinking.add(chunk.value.index)
      }

      yield chunk.value
      chunk = await stream.next()
    }

    const response = chunk.value

    if (e.agentId !== undefined) {
      return response
    }

    if (head === null) {
      pendingThoughts += thinking.size
    } else if (thinking.size > 0) {
      const id = head
      try {
        await update($, segments, all => ({ ...all, [id]: { ...emptyCounts(), ...all[id], thought: (all[id]?.thought ?? 0) + thinking.size } }))
      } catch {
        // A failed write only undercounts this segment's thoughts.
      }
    }

    if (response.answer.trim() !== '') {
      opensSegment = true
    }

    return response
  })

  // "Background command ... completed" and "Monitor event: ..." rows; ctrl+o still shows them.
  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (e.props.origin.kind !== 'task-notification' || e.props.isExpanded || !isQuietNotification(e.props.task?.status)) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  // turn.complete text would show under the plugin names; the footer is drawn in the TurnDuration row instead.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined) {
      await update($, active, () => null)
      const lines = summarize({ model: e.usage?.model ?? '', durationMs: e.durationMs, outputTokens: e.usage?.output_tokens ?? 0, reason: e.reason })
      await update($, footers, all => ({ ...all, [String(e.durationMs)]: lines }))
    }

    return result
  })

  // A call that heads a segment draws its line; errors and interruptions keep the engine's row too.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const line = segmentRow([e.props.tool_use_id], await read($, heads), await read($, segments), await read($, active))
    const { Box, Text } = $.ui.resolve(e)
    const row = e.props.isErrored || e.props.isInterrupted ? await next(e) : null

    if (line === null) {
      return row ?? <Box />
    }

    return (
      <Box flexDirection="column">
        <Text dimColor>{line}</Text>
        {row}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, ($, e, next) => {
    if (e.props.isErrored) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  // ctrl+o (or --verbose) unfolds a group into its calls; folded, it draws its segment's line or nothing.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (e.props.isExpanded) {
      return next(e)
    }

    const line = segmentRow(e.props.calls.map(call => call.tool_use_id), await read($, heads), await read($, segments), await read($, active))
    const { Box, Text } = $.ui.resolve(e)

    return line === null ? <Box /> : <Text dimColor>{line}</Text>
  })

  // The row's durationMs can drift from turn.complete's; a turn with no footer near it draws nothing.
  on('ui.render', { component: 'TurnDuration' }, async ($, e) => {
    const lines = footerFor(await read($, footers), e.props.durationMs)
    const { Box, Text } = $.ui.resolve(e)

    if (lines === undefined) {
      return <Box />
    }

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
