import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { isNarration, isQuietNotification, rememberNarration } from './narration'
import { countLabel, emptyCounts, footerFor, kindOf, summarize } from './summary'

const calls = atom({ plugin: 'quiet-tools', key: 'calls' } as const, 0)
const footers = atom({ plugin: 'quiet-tools', key: 'footers' } as const, {})
const narrations = atom({ plugin: 'quiet-tools', key: 'narrations' } as const, [])
const answers = atom({ plugin: 'quiet-tools', key: 'answers' } as const, [])

export const register: Register = on => {
  // Main-loop turn state; a reload mid-turn starts it over, which skews that turn's footer and can leave
  // a summary written before its last tool call hidden.
  let counts = emptyCounts()
  let tools = 0
  let lastNarration = ''

  on('turn.start', async ($, e, next) => {
    counts = emptyCounts()
    tools = 0
    lastNarration = ''
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

  // Forwards the stream untouched; only reads the finished step to learn which text was narration.
  on('turn.step', async function* ($, e, next) {
    const response = yield* next(e)

    if (e.agentId === undefined && response.toolUses.length > 0) {
      if (response.answer.trim() !== '') {
        lastNarration = response.answer
      }

      try {
        await update($, narrations, all => rememberNarration(all, response.answer))
      } catch {
        // A failed write only leaves this narration visible.
      }
    }

    return response
  })

  // A block that is also part of a turn's answer stays, so a short answer repeated from a narration shows.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const hidden = isNarration(e.props.text, await read($, narrations)) && !isNarration(e.props.text, await read($, answers))

    if (e.props.isSummary !== true && !hidden) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
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
      // A finished turn with an empty final step answered in its last narration (a summary, then TodoWrite);
      // an interrupted or failed one did not.
      const answer = e.answer.trim() !== '' ? e.answer : e.reason === 'answer' ? lastNarration : ''

      // Written before the footer, so a failed footer write cannot leave the answer hidden.
      try {
        await update($, answers, all => rememberNarration(all, answer))
      } catch {
        // A failed write only leaves an answer that repeats a narration hidden.
      }

      const lines = summarize({ counts, model: e.usage?.model ?? '', durationMs: e.durationMs, outputTokens: e.usage?.output_tokens ?? 0, reason: e.reason })
      await update($, footers, all => ({ ...all, [String(e.durationMs)]: lines }))
    }

    return result
  })

  // A successful or running call draws nothing; errors and interruptions keep the engine's row.
  on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
    if (e.props.isErrored || e.props.isInterrupted) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on('ui.render', { component: 'ToolResult' }, ($, e, next) => {
    if (e.props.isErrored) {
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
