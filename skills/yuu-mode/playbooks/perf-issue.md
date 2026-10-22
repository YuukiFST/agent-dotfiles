# Perf issue

Every fix ties to a measurement; reading source is not measuring.
Web pages route to `web-perf` and desktop launch time to `optimizing-startup`; this playbook covers the rest.

1. Capture a baseline on the real workload plus a profile or trace of it, and vet it and every later number with `principle-explain-the-number`.
2. Ground the hypotheses in that profile or trace, then try the performance mantras cheapest first, stopping at the first that meets the target:
   1. Don't do it: stop work whose result nothing uses.
   2. Do it, but don't do it again.
   3. Do it less.
   4. Do it later.
   5. Do it when they're not looking.
   6. Do it concurrently.
   7. Do it cheaper.
3. Fix one hypothesis at a time and measure after each (`principle-sequence-verifiable-units`); a change with no measured gain is reverted.
4. Compare baseline and post-fix artifacts side by side. An inconclusive comparison is reported as inconclusive.
5. Cite the measurement in the commit or PR body; ship through `git-workflow` when the user invoked `/git-workflow`.

**Reply:** baseline number, post-fix number, delta with units, and the artifact path.
