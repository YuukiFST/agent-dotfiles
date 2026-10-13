# Blast radius

Find what a risky change breaks somewhere else, beyond the diff, and prove the fact it is safe because of by running real code.

Listing the callers is not the job: grep finds those in a second.
The job is the breakage grep will not show you.

## Proof levels

A blast-radius writeup that sounds right is worthless on its own, because it reads as convincing whether or not it is true.
For each fact the change's safety depends on, push it as far down this list as is cheap, and report where it stopped:

1. **Asserted.** You said so.
2. **Cited.** A real `file:line`, or the library's own source at its pinned version.
3. **Walked.** You traced the failure step by step and showed it cannot be reached.
4. **Ran.** A script or test calls the real code and fails loudly if you are wrong.
5. **Reproduced.** You exercised it in the running app.

Level 4 is usually one small script that imports the same library the app ships and calls the exact function you are worried about.

## Steps

1. **Read the change.** The diff, the symbols it adds, changes and deletes, and what it now does differently, including the part the diff does not spell out; `git log` and the PR body give the why.
2. **Find the safety fact.** Most changes that look risky are safe because of a single fact, like "this call only drops cache entries that are already dead".
   Find that fact; if it holds, most of the risky cases clear at once, so spend your time here rather than on a long list of maybes.
3. **Look where grep stops.** Read the source of the library you call, at its pinned version and with any local patch.
   Work out when things run: microtasks, teardown, unmount, process exit.
   Follow what a symbol search misses: the JSON an API returns, a DB column, a wire format, another language reading the same bytes, a feature flag, code three hops downstream.
4. **Grade each risk.** Give it a real chance of happening and a real cost if it does, with a `file:line`.
   Keep the confirmed risks, and list the ones you checked and cleared separately; a search that finds nothing is still an answer, and a caller or API you did not find does not exist.
5. **Prove the safety fact.** Write a script or test that runs the real code, run it, and paste what happened.
   Put the script in a fresh `mktemp -d` directory, not the repo, and delete it afterwards unless the user wants it as a regression test.

## Hand back

- **What it does:** what changed, including the part that is not obvious.
- **Safety fact:** the fact, the proof level it reached, and the proof output; "unproven" when you could not get it past level 3.
- **Risks:** each with how it breaks, `file:line`, likelihood and cost, and how to check it.
- **Cleared:** what you checked and why it is fine.
- **Before you merge:** the cheapest test or repro that catches the real bug, including the script you wrote.
