import { expect, test } from 'claude-code/testing'

const ok = {
  tool_use_id: 't1',
  tool: 'Bash',
  input: { command: 'ls' },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: successful tool row draws nothing`, async $ => {
    const ui = await $.ui.mount({ plugin: 'quiet-tools', surface, component: 'ToolUse', props: ok, requestId: 't1' })

    expect(await ui.find({ text: 'ls' })).toBeUndefined()
  })

  test(`${surface}: markdown write is hidden like any other call`, async $ => {
    const md = { ...ok, tool: 'Write', input: { file_path: 'docs/NUCLEO.md', content: '# Núcleo do kit' } }
    const ui = await $.ui.mount({ plugin: 'quiet-tools', surface, component: 'ToolUse', props: md, requestId: 't2' })

    expect(await ui.find({ text: 'NUCLEO' })).toBeUndefined()
  })

  test(`${surface}: spinner shows only the call count`, async $ => {
    const ui = await $.ui.mount({
      plugin: 'quiet-tools',
      surface,
      component: 'Spinner',
      props: { word: 'Sauteing', message: null, suffix: '…', mode: 'tool-use' },
      requestId: 'main',
    })

    expect(await ui.find({ text: '0 tool calls' })).toBeDefined()
    expect(await ui.find({ text: 'Sauteing' })).toBeUndefined()
  })
}

test('terminal: turn footer replaces the duration line', async ($, on) => {
  on('ui.render', { component: 'TurnDuration' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>Baked for 40s</Text>
  })
  on('turn.complete', () => ({ text: 'done' }))

  const usage = { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 1550, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
  await $.turn.complete({ answer: 'done', durationMs: 40500, isAborted: false, turnId: 'turn-1', reason: 'answer', usage })

  const ui = await $.ui.mount({
    plugin: 'quiet-tools',
    surface: 'terminal',
    component: 'TurnDuration',
    props: { word: 'Baked', durationMs: 40500 },
    requestId: 'm1',
  })

  expect(await ui.find({ text: 'Opus 5.5 · 40.5s · 38.3 tok/s' })).toBeDefined()
  expect(await ui.find({ text: 'Baked for 40s' })).toBeUndefined()
})

test('terminal: narration between tool calls is hidden, the final answer stays', async ($, on) => {
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.props.text}</Text>
  })
  on('turn.step', async function* ($, e) {
    const toolUses = e.index === 0 ? [{ id: 'tu1', name: 'Bash', input: { command: 'ls' } }] : []
    const answer = e.index === 0 ? 'Supabase de pé. Subindo banco de teste.' : 'Merge feito.'

    return { turnId: e.turnId, index: e.index, answer, toolUses, stopReason: 'end_turn', usage: null }
  })

  for (const index of [0, 1]) {
    const stream = $.turn.step({ turnId: 'turn-1', index, model: 'claude-opus-5-5', messageCount: 1 })
    for await (const _ of stream) {
      // drain
    }
  }

  const mount = (text: string, requestId: string) =>
    $.ui.mount({ plugin: 'quiet-tools', surface: 'terminal', component: 'AssistantMessage', props: { text, isFirstOfReply: true }, requestId })

  expect(await (await mount('Supabase de pé. Subindo banco de teste.', 'a1')).find({ text: 'Supabase' })).toBeUndefined()
  expect(await (await mount('Merge feito.', 'a2')).find({ text: 'Merge feito.' })).toBeDefined()
})

test('terminal: completed task notification is hidden, a failed one stays', async ($, on) => {
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.props.text}</Text>
  })

  const mount = (status: string, requestId: string) =>
    $.ui.mount({
      plugin: 'quiet-tools',
      surface: 'terminal',
      component: 'UserMessage',
      props: { text: `Background command ${status}`, origin: { kind: 'task-notification' }, isExpanded: false, task: { status } },
      requestId,
    })

  expect(await (await mount('completed', 'u1')).find({ text: 'Background command' })).toBeUndefined()
  expect(await (await mount('failed', 'u2')).find({ text: 'Background command failed' })).toBeDefined()
})
