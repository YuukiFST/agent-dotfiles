---
name: principle-fix-root-causes
description: "Apply when debugging a bug, test failure, crash, or unexpected behavior. Reproduce first, ask why until you reach the root cause, and fix it there instead of adding a guard that silences the symptom."
---

# Fix root causes

When debugging, do not fix symptoms. Trace every problem to its root cause and fix it there.

**Why:** Symptom fixes accumulate. Each workaround makes the system harder to reason about, and the real bug remains. Root-cause fixes are slower upfront but reduce total debugging time.

**Pattern:**
- Reproduce first. The repro goes red on the bug before any fix is written, and the same repro goes green after.
- Ask "why" until you hit the root cause
- Do not add guards (adding a nil check to silence a crash is a symptom fix)
- If a workaround needs a paragraph-long comment to justify it, the code is wrong (fix the code, not the comment)
- Check for the pattern, not just the instance (grep for the same pattern, fix all instances)
- When stuck, instrument. Don't guess (add logging, read the actual error)
- Two fixes that share one premise failed the same check: stop fixing and apply [Attack the Premise](../principle-attack-the-premise/SKILL.md).

**Restart bugs: suspect state before code**

When something "fails after restart," suspect stale persistent state first: config files, caches, lock files, serialized state. If clearing a state file restores behavior, prioritize state validation as the fix.

Source: [pstack](https://github.com/cursor/plugins/tree/main/pstack/skills/principle-fix-root-causes), MIT, see `LICENSE`.
