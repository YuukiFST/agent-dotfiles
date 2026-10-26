# Sources

`handoff` is forked from [mattpocock/skills `skills/productivity/handoff`](https://github.com/mattpocock/skills/tree/main/skills/productivity/handoff) (MIT), pinned in `skills/UPSTREAMS.tsv`.
The fork adds the mode choice, live git state, the fixed template, the claim audit and the paste-ready prompt (issue #188), so an upstream refresh merges into it instead of replacing it.

## Refreshing

1. Run `bash scripts/check-upstreams.sh handoff` and read the diff of `skills/productivity/handoff/` behind the compare link it prints.
2. Fold each upstream change into `SKILL.md` where it does not contradict the fork, then move the pin in `skills/UPSTREAMS.tsv`.
