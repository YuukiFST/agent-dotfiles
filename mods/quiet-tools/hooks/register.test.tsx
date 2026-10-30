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
  test(`${surface}: a call that heads no segment draws nothing`, async $ => {
    const ui = await $.ui.mount({ plugin: 'quiet-tools', surface, component: 'ToolUse', props: ok, requestId: 't1' })

    expect(await ui.find({ text: 'ls' })).toBeUndefined()
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

// One model step: optional thinking, the step's text, then its tool calls; the ids the engine gave them, in order.
type Step = { thinking?: boolean; answer: string; tools: string[] }

const runTurn = async ($: any, on: any, steps: Step[]): Promise<string[]> => {
  const ids: string[] = []

  on('turn.step', async function* ($: any, e: any) {
    const step: Step = steps[e.index] ?? { answer: '', tools: [] }

    if (step.thinking === true) {
      yield { kind: 'thinking', index: 0, text: 'hmm' }
    }

    return { turnId: e.turnId, index: e.index, answer: step.answer, toolUses: step.tools.map(name => ({ name, input: {} })), stopReason: 'end_turn', usage: null }
  })
  on('tool.call', ($: any, e: any) => {
    ids.push(e.tool_use_id)

    return { result: {} }
  })
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: steps.at(-1)?.answer }))

  await $.turn.start({ text: 'Auditoria', turnId: 'turn-1' })

  for (const [index, step] of steps.entries()) {
    for await (const _ of $.turn.step({ turnId: 'turn-1', index, model: 'claude-opus-5-5', messageCount: 1 })) {
      // drain
    }

    for (const tool of step.tools) {
      await $.tool.call({ tool, input: tool === 'Bash' ? { command: 'ls' } : { file_path: 'a.ts' } })
    }
  }

  return ids
}

const toolRow = ($: any, tool_use_id: string | undefined, tool: string) =>
  $.ui.mount({ plugin: 'quiet-tools', surface: 'terminal', component: 'ToolUse', props: { ...ok, tool_use_id, tool }, requestId: tool_use_id })

// Source: the user's OpenCode "Verbosity: Low" screenshot; narration stays, each run of tools between texts is one count line.
test('terminal: each run of tools between two texts draws one count line on its first call', async ($, on) => {
  on('ui.render', { component: 'AssistantMessage' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.props.text}</Text>
  })

  const ids = await runTurn($, on, [
    { thinking: true, answer: 'Vou investigar a aba Auditoria.', tools: ['Bash', 'Read', 'Read'] },
    { thinking: true, answer: '', tools: ['Grep'] },
    { answer: 'Agora os testes de regressão.', tools: ['Edit', 'Bash'] },
  ])

  const first = await toolRow($, ids[0], 'Bash')
  expect(await first.find({ text: '+ 1 command, 2 thoughts, 2 reads, 1 tool' })).toBeDefined()
  expect(await (await toolRow($, ids[1], 'Read')).find({ text: 'reads' })).toBeUndefined()

  const second = await toolRow($, ids[4], 'Edit')
  expect(await second.find({ text: '⋮ 1 command, 1 edit' })).toBeDefined()

  const narration = await $.ui.mount({
    plugin: 'quiet-tools',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text: 'Vou investigar a aba Auditoria.', isFirstOfReply: true },
    requestId: 'a1',
  })
  expect(await narration.find({ text: 'Vou investigar' })).toBeDefined()

  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 'turn-1', reason: 'answer' })
  expect(await second.find({ text: '+ 1 command, 1 edit' })).toBeDefined()
})

test('terminal: a folded group draws its segment line, an unfolded one the engine rows', async ($, on) => {
  on('ui.render', { component: 'ToolGroup' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)

    return <Text>Read 2 files</Text>
  })

  const ids = await runTurn($, on, [{ answer: 'Lendo.', tools: ['Read', 'Read'] }])
  const calls = ids.map(tool_use_id => ({ tool_use_id, tool: 'Read', input: {}, isRunning: false, isErrored: false, isInterrupted: false }))
  const group = (isExpanded: boolean, requestId: string) =>
    $.ui.mount({ plugin: 'quiet-tools', surface: 'terminal', component: 'ToolGroup', props: { calls, isActive: false, isExpanded }, requestId })

  expect(await (await group(false, 'g1')).find({ text: '⋮ 2 reads' })).toBeDefined()
  expect(await (await group(true, 'g2')).find({ text: 'Read 2 files' })).toBeDefined()
})
