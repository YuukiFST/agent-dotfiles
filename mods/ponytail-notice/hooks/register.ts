import type { Register } from 'claude-code'

// Mirrors the SubagentStart matcher in YuukiFST/ponytail-subagent hooks/hooks.json.
const PONYTAIL_AGENT_TYPES = /^general-purpose$/

export const register: Register = on => {
  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)

    if (spawned.agentId !== undefined && PONYTAIL_AGENT_TYPES.test(e.subagentType)) {
      $.ui.log(`ponytail active in ${e.subagentType}: ${e.description}`)
    }

    return spawned
  }).catch(($, e, next) => next(e))
}
