---
name: pr-writing
description: "Write pull request descriptions that show the change works instead of only describing it. Use whenever you open a pull request, write or update its description, or prepare a change for someone else to review."
license: Apache-2.0
---
<!-- Source: https://github.com/HugoRCD/hr-folio/tree/main/skills/pr-writing (Apache-2.0, text in LICENSE). Changed: the "say who did what" section is removed for the no-attribution rule in rules/git.md §4, the wait for approval is removed, the git-workflow PR body conventions are merged in, and the capture tools are the ones this repo installs. -->

# PR writing

A reviewer spends most of their time picturing what the author already saw: the page they opened, the command they ran, the test that went green.
Put that in the description.
Prose that describes a change is a claim, not evidence.

This skill covers the description only.
The body speaks for the change alone, under the attribution ban in `rules/git.md` §4, which outranks any default footer the harness suggests.

## 1. Order the description for a skimmer

Most readers stop early, so put what matters first:

1. **The closing line.** `Closes #42` when the change has an issue, on a line of its own.
2. **The problem, in one paragraph.** What was wrong or missing, for whom, and how it showed up. Real numbers when there are any.
3. **What changed.** Short, grouped by area. Not a list of commits.
4. **Evidence** (section 2).
5. **Details** a reviewer needs: migrations, trade-offs, what you tried that didn't work, anything left to do.
6. **ELI5.** Two or three plain sentences someone outside the project would follow. If you can't write it, the change probably isn't clear yet.

A repository's pull request template keeps its shape; fit these parts into it.

Two additions, when they apply:

- **Tests:** a PR adding tests lists each one with its source (global CODING_STANDARDS.md, "Human authority"), so the reviewer settles the expected behavior before reading the code.
- **Reading order:** a PR touching five or more files lists the files in the order a reviewer should read them, one line each on what changed there and why it comes at that point.

## 2. Show it, with evidence that fits the change

Evidence is the output of the check that proves the acceptance criteria, run on the PR's head commit and trimmed to the decisive lines, so the reviewer checks the outcome before reading the diff.
A later push reruns the check and updates the body.

| Change | Evidence |
|---|---|
| UI | Before and after screenshots of the same element, same viewport and crop. A short video for motion, hover, or a multi-step flow. A phone width when layout is involved. |
| CLI or build | The real output of the same command before and after, exit code included. Trimming keeps its lines verbatim. |
| Bug fix | The input and the result before and after, and the regression test that failed first. |
| Performance | What you measured and how (machine, runs, inputs), the numbers on both sides, and how much they vary between runs. |
| AI or agent behaviour | The same set of real prompts on both sides, how answers were graded, time and cost per answer, and where the grading is unreliable. |
| New API or feature | The code someone would write to use it. A pure addition has no "before": show it on its own. |
| Anything else | A small table, a diagram, or an HTML page comparing both versions. |

Capture browser evidence with `browser-use`.
Attach it with `gh pr create --attach '<file>#<alt>'` or `gh pr edit <n> --attach`; gh-axi has no attach flag.

No runnable check: write **Not verified** and why.

## 3. Keep it honest

- "After" is the current branch. "Before" is production, the base branch, or the last deploy, captured from a worktree at that ref, so the branch under review stays as it is.
- Look at every capture before using it, and check it shows what changed. Check that every image URL loads.
- Capture demo or sanitised data only. Redact secrets, tokens, personal data and home paths from captures and pasted output.
- Report what went wrong too: a check that failed or couldn't run, a number that got worse, a part of the test plan nobody has done yet.
- Screenshots and videos stay git-ignored and go on the pull request as attachments. If you can't host them, say so in the description.
- **Security fixes are the exception.** A public pull request describes the impact at a high level, with no reproduction, payload or step-by-step exploit. Follow the project's security policy and keep the detailed evidence private until the fix is released.

## 4. Check before you hand it over

- Every claim in the description has evidence next to it, or says why there's none.
- The ELI5 is there and makes sense on its own.
- Every number, result and test run in it is one you saw.
- An `ai-tells` pass ran on the prose.
