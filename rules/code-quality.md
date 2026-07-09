# Code quality & project improvement (MANDATORY — skills drive every change)

**Triggers (either one):**
1. Any request to improve the code or project — "improve my code", "aprimorar o código", "make the project better", audit, refactor, harden, optimize, review, "where to next".
2. **/goal building a project from a PRD:** this file governs the whole build, not just the end. During development, route work through the matching skills (design → `codebase-design`; sensitive surface → `security-review`; hard bugs/perf → `diagnosing-bugs`). At closeout — before declaring the /goal done — ALWAYS run the final quality pass: `improve` scoped to the code produced, then steps 3–4 (security + review gate) on the diff.

**Iron rule:** the agent NEVER improves code from its own judgement. Every change originates from a skill below or from a plan a skill produced. No freelance fixes, no "I'll just clean this up" outside a skill. If no skill covers the work, say so — do not improvise. **Exception (overrides iron rule):** a broken lint, typecheck, or test found along the way is always fixed on the spot — that is an obligation from global CLAUDE.md, not a freelance improvement.

**Execution flow — run it end to end; do not stop at the plan:**

1. **Audit → plan.** Run `improve`: it surveys the whole codebase (bugs, security, perf, test gaps, tech debt, migrations, DX) and emits prioritized, self-contained plans. `improve` is read-only — it writes the plan, not the code.
2. **Execute every plan.** Implement each plan `improve` produced, in priority order. Architecture/design work goes through `codebase-design` (vocabulary + deep-module principles) and `improve-codebase-architecture` (deepening opportunities); use `domain-modeling` only when changing the domain model / ubiquitous language. Hard bugs and performance regressions → `diagnosing-bugs`.
3. **Security.** Any auth / input / secrets / endpoint / upload / PII / 3rd-party surface touched → `security-review` while building, and `security-bounty-hunter` for an adversarial attack-surface pass.
4. **Review gate (before declaring done or committing).** `autoreview` on the diff / branch / PR; escalate to `thermo-nuclear-code-quality-review` for high-risk diffs (auth, money, concurrency, data-loss) — brutal audit of correctness, security, performance, races, leaks, API contracts.

**Skills (all in repo `skills/`):**
- `improve` — read-only advisor sweep → prioritized plans. The agent then EXECUTES those plans (steps 2–4); it does not hand them off and stop.
- `codebase-design` — shared vocabulary + deep-module principles for any design/refactor.
- `improve-codebase-architecture` — scan for deepening opportunities → report → grill. Built on `codebase-design`.
- `domain-modeling` — only when changing the domain model / ubiquitous language.
- `diagnosing-bugs` — disciplined loop for hard bugs and performance regressions.
- `security-review` / `security-bounty-hunter` — building the sensitive surface / hunting exploitable vulns.
- `autoreview` / `thermo-nuclear-code-quality-review` — closeout review / brutal max-scrutiny escalation.

Performance has no dedicated global skill — `improve` finds perf issues, `thermo-nuclear-code-quality-review` audits them, `diagnosing-bugs` handles regressions. If the project provides `react-performance` (project-level skill, e.g. SB360), use it for React/Next perf work.
