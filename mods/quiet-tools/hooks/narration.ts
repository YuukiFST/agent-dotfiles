// Text the model wrote in a step that also called tools: progress narration, never the turn's answer.
export const NARRATION_CAP = 500

export const rememberNarration = (all: readonly string[], answer: string) => {
  const text = answer.trim()

  return text === '' ? all : [...all, text].slice(-NARRATION_CAP)
}

// A transcript block is one piece of a step's answer, so it matches when a stored answer contains it.
export const isNarration = (block: string, all: readonly string[]) => {
  const text = block.trim()

  return text !== '' && all.some(answer => answer.includes(text))
}

// Monitor events carry no status; a failed or killed task keeps its row.
export const isQuietNotification = (status: string | undefined) => status === undefined || status === 'completed'
