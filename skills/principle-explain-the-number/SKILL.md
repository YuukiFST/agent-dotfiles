---
name: principle-explain-the-number
description: "Apply before you trust, report, or act on a number you measured: a speedup, a regression, a throughput, a latency, a count, or an eval result. Find what limits it, and rule out that it measured something other than the work you think."
---

# Explain the number

A measured number is a claim about a system. Before you trust it, report it, or act on it, find what limits it and rule out that it measured something else.

**Why:** A run that went wrong still prints a plausible number. Requests that failed, a cache that skipped the work, code that never ran, a side left on default settings, and run-to-run noise all produce results that look fine. If you cannot say why the number is not twice as good, you do not know what you measured.

**Pattern:**

- **Ask "why not double?"** Name the resource or code path that bounds the result, such as a core, a lock, the disk, the network, or the load generator itself. Get it from a profile or from system counters taken during a run, then map it to source. A guess from reading the code is not a limiter.
- **List what else the number could be measuring, and rule out each one with evidence.** The usual suspects are errors, skipped or cached work, an untuned side, noise, and a piece too small to matter end to end.
- **Did the work happen?** Count failures and check that the outputs are correct, not just present. Lazy code, unawaited promises, and timeouts all produce numbers for work that never ran.
- **Repeat it.** Run each side at least 5 times, alternating A, B, A, B. Report the median and the range. A gap smaller than the run-to-run spread is no measurable difference.
- **Keep the evidence with the number.** Put the run count, the spread, and the limiter in the notes or a linked artifact, so a reader can check the claim.

For a performance comparison, run both sides the way production runs them (release build, production flags, same data). One side on defaults compares configurations, not implementations.

You skipped this when the evidence behind a number has no run count, no spread, or no named limiter, or when the time saved is larger than the time the changed piece took.

Distinct from [Prove It Works](../principle-prove-it-works/SKILL.md), which checks that an output is real. This checks that a measured number means what you say it means.

Source: [pstack](https://github.com/cursor/plugins/tree/main/pstack/skills/principle-explain-the-number), MIT, see `LICENSE`.
