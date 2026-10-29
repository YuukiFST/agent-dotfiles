import { expect, test } from 'claude-code/testing'

async function spawnAndCollectLogs($, on, subagentType: string) {
  const logs: string[] = []
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'agent-1' }))
  on('ui.log', ($, e, next) => {
    logs.push(e.text)

    return next(e)
  })

  await $.agent.spawn({ prompt: 'fix the bug', description: 'Fix bug', subagentType })

  return logs
}

test('general-purpose spawn logs the ponytail line', async ($, on) => {
  const logs = await spawnAndCollectLogs($, on, 'general-purpose')

  expect(logs).toEqual(['ponytail active in general-purpose: Fix bug'])
})

test('read-only subagent spawn logs nothing', async ($, on) => {
  const logs = await spawnAndCollectLogs($, on, 'Explore')

  expect(logs).toEqual([])
})
