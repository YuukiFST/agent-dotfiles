# CI speed

Make a repo's CI fast without letting it lie.
Adapted from Pontus Abrahamsson's CI prompt (https://x.com/pontusab/status/2121990184816484483).
Default target: a PR gets its result in under 2 minutes at the median and under 3 at p95; the user's number wins when they name one.

Two rules outrank speed:

- **The full suite gates `main`:** it runs before anything reaches `main`, in a merge queue or on the push to `main`; selection only narrows PR feedback.
- **Speed never hides a failure:** no retries, wider timeouts or skipped tests. A check that needs a retry has a bug: find it with `principle-fix-root-causes`.

1. **Audit.** Pull the last 150 runs (`gh-axi run list`, or `gh run list --json` and each run's jobs) and split every job into waiting, setup and running, at p50 and p95.
   Vet every number with `principle-explain-the-number`. Done when the biggest bucket is named; it is rarely the tests, so deleting tests is not a lever.
2. **Fix the biggest bucket first,** one change per PR, against these budgets:
   - **Waiting, under 10 s:** cancel a branch's in-progress run when a new commit lands (`concurrency` with `cancel-in-progress`). A faster runner provider is a paid account: it goes on the step 5 list.
   - **Setup, under 30 s:** PR cache hits above 95% by seeding caches from `main`; cache the installed dependency dir itself, keyed on the lockfile, not only the package manager's cache; a blobless clone (`filter: blob:none`) over a shallow one when the job reads history.
   - **Lint and typecheck, under 5 s each:** a faster tool (oxlint for ESLint, oxfmt for Prettier, a native typechecker) is a candidate, never a default: run old and new side by side on the repo, list everything the new one misses, and switch only when the user accepts that list.
     A new tool is a new dependency, so the switch is the user's call.
   - **Tests, under 60 s per shard:** stop reloading the app per test file where the runner allows it (Vitest `isolate: false`) with state reset after every file, and write those cleanup rules into the project's `AGENTS.md`; run in random order to flush out leaks; shard by measured duration, each shard with its own database; add cores before shards, and match concurrency to cores.
   - **Shape:** lint, typecheck, build and tests run as parallel jobs; migration checks and other apps' tests move out of the slowest job into their own.
     Each job calls one script from the project's own task file, so the local gate and CI keep one definition.
   - **Selection:** on PRs, run only what the diff reaches (`nx affected`, `turbo --affected`, `vitest --changed`).
     Then hide a real change from the selection on purpose and confirm CI goes red, not green; a selection that passes the planted change is reverted.
   - **Local, under 10 s:** a pre-commit or pre-push hook runs format and lint on the changed files plus an incremental typecheck, per `CODING_STANDARDS.md` **Fast local gate**.
   - **Keep it fast:** every job carries a `timeout-minutes` at its budget plus margin, so a regression fails loudly instead of creeping.
3. **Measure each change on real runs:** at least five CI runs before and after, same workflow, p50 and p95 per bucket. A change with no measured gain is reverted.
4. **Ship one small PR per change,** its body carrying the before and after numbers from real runs and every reverted attempt.
5. **Do everything that needs no account first;** bring anything that needs an account, a secret or a bigger bill as one list with the expected monthly cost.

**Reply:** total CI time at p50 and p95 and monthly cost, before and after; one line per change (bucket, before to after, kept or reverted); the step 5 list.
