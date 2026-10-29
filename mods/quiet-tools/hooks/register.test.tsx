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

  test(`${surface}: markdown edit keeps the engine row`, async ($, on) => {
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)

      return <Text>engine row</Text>
    })

    const md = { ...ok, tool: 'Edit', input: { file_path: 'docs/README.md', old_string: 'a', new_string: 'b' } }
    const code = { ...md, input: { ...md.input, file_path: 'src/app.ts' } }
    const mdRow = await $.ui.mount({ plugin: 'quiet-tools', surface, component: 'ToolUse', props: md, requestId: 't2' })
    const codeRow = await $.ui.mount({ plugin: 'quiet-tools', surface, component: 'ToolUse', props: code, requestId: 't3' })

    expect(await mdRow.find({ text: 'engine row' })).toBeDefined()
    expect(await codeRow.find({ text: 'engine row' })).toBeUndefined()
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
