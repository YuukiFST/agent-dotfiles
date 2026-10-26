# Interrogate reviewers

One row per reviewer; the `interrogate` skill reads the rows for the harness it runs in: only the first on a diff that is not risky, all of them on a risky one, so put the strongest row first.
Add rows to run more reviewers in parallel on risky diffs: reviewers on different model families catch different bugs.

| Harness | Model | Effort |
|---------|-------|--------|
| claude-code | opus | high |
| opencode | opencode-go/deepseek-v4.1-flash | max |

## Columns

- **claude-code** rows go straight to the `Agent` tool at review time.
  Model is one of its aliases (`opus`, `sonnet`, `haiku`, `fable`); effort is `low`, `medium`, `high`, `xhigh` or `max`.
- **opencode** rows become agent files, because OpenCode's `task` tool takes no model.
  `sync-config` writes one `~/.config/opencode/agents/interrogate-reviewer-<n>.md` per row, in row order, and deletes stale ones, so run the sync after editing.
  Model is a `provider/model` id from `opencode models`; effort is the model's variant (`low`, `medium`, `high`, plus `max` on DeepSeek V4 models), or empty for the provider default.
