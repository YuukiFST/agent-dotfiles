# Perf issue

Every fix ties to a measurement; reading source is not measuring.
This is the fix loop inside `perf-ratchet`'s cycle, on every project: its Setup records the baseline before the first change, and its gate closes the work, so the fix also proves no other metric got worse.

1. Take the baseline from `perf-ratchet`'s `check` on the real workload plus a profile or trace of it (`web-perf`'s audit for a web page), and vet it and every later number with `principle-explain-the-number`.
2. Ground the hypotheses in that profile or trace, then try the performance mantras cheapest first, stopping at the first that meets the target:
   1. Don't do it: stop work whose result nothing uses.
   2. Do it, but don't do it again. A new cache comes only after the redesign in `perf-ratchet`'s `techniques.md` failed to win the time back.
   3. Do it less.
   4. Do it later.
   5. Do it when they're not looking.
   6. Do it concurrently.
   7. Do it cheaper.
3. Fix one hypothesis at a time and measure after each (`principle-sequence-verifiable-units`); a change with no measured gain is reverted.
   A rewrite of a hot path keeps the old version as a differential oracle (`test-audit`), so the speedup ships with output proven unchanged.
4. Run `perf-ratchet`'s gate and compare baseline and post-fix artifacts side by side. An inconclusive comparison is reported as inconclusive.
5. Cite the measurement in the commit or PR body, with every attempt listed there, reverted ones included (idea, baseline to result, kept or reverted), so a dead idea is not tried again; ship through `git-workflow` when the user invoked `/git-workflow`.

**Reply:** baseline number, post-fix number, delta with units, and the artifact path.
