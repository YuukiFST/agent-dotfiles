import { expect, test } from 'claude-code/testing'

import { emptyCounts, footerFor, modelLabel, segmentLine, summarize } from './summary'

test('footer with model, speed and interruption', () => {
  expect(summarize({ model: 'claude-opus-5-5', durationMs: 5300, outputTokens: 454, reason: 'aborted' })).toEqual([
    'Opus 5.5 · 5.3s · 85.7 tok/s · interrupted',
  ])
})

test('unknown model id is kept as given', () => {
  expect(modelLabel('some-model')).toBe('some-model')
})

test('segment line follows the OpenCode order and singulars', () => {
  const counts = { ...emptyCounts(), command: 14, thought: 1, read: 21, tool: 4 }

  expect(segmentLine(counts, false)).toBe('+ 14 commands, 1 thought, 21 reads, 4 tools')
  expect(segmentLine(counts, true)).toBe('⋮ 14 commands, 1 thought, 21 reads, 4 tools')
})

test('footer lookup tolerates a small duration drift and gives up beyond it', () => {
  const all = { '1493000': ['+ 8 commands'], '10000': ['+ 1 tool'] }

  expect(footerFor(all, 1493000)).toEqual(['+ 8 commands'])
  expect(footerFor(all, 1494200)).toEqual(['+ 8 commands'])
  expect(footerFor(all, 1600000)).toBeUndefined()
})
