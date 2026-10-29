import { expect, test } from 'claude-code/testing'

import { emptyCounts, kindOf, modelLabel, summarize } from './summary'

test('footer with counts, model, speed and interruption', () => {
  const counts = { command: 60, edit: 17, read: 5, tool: 4 }
  const lines = summarize({ counts, model: 'claude-opus-5-5', durationMs: 5300, outputTokens: 454, reason: 'aborted' })

  expect(lines).toEqual(['+ 60 commands, 17 edits, 5 reads, 4 tools', 'Opus 5.5 · 5.3s · 85.7 tok/s · interrupted'])
})

test('turn without tools shows the footer alone', () => {
  expect(summarize({ counts: emptyCounts(), model: 'claude-sonnet-5-5', durationMs: 2000, outputTokens: 100, reason: 'answer' })).toEqual([
    'Sonnet 5.5 · 2.0s · 50.0 tok/s',
  ])
})

test('unknown model id is kept as given', () => {
  expect(modelLabel('some-model')).toBe('some-model')
})

test('one read and one edit use the singular', () => {
  const counts = { ...emptyCounts(), read: 1, edit: 1, [kindOf('Grep')]: 2 }

  expect(summarize({ counts, model: '', durationMs: 1000, outputTokens: 0, reason: 'answer' })).toEqual(['+ 1 edit, 1 read, 2 tools', '1.0s'])
})
