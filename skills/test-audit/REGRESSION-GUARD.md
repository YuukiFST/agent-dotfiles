# Regression guard

A frozen regression test guards its bug only while no change to it goes
unseen. This CI step fails a PR that modifies, renames or deletes a file whose
path contains `regression`, until the user adds the `regression-change-approved`
label. A regression file the PR adds passes, even when a later commit in the
same PR edits it: it is not frozen until it lands.

The label is a speed bump, not a lock. An agent acting through the user's
GitHub account can add it, which is why global CODING_STANDARDS.md ("CI guards
the frozen set") reserves it for the user. What the step guarantees is that the
change shows up as a red check the user has to clear.

## GitHub Actions

Land it as its own commit, the same way as the suite job: a new workflow file,
or this job added to the project's existing PR workflow.

```yaml
name: regression-guard
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]
jobs:
  regression-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Frozen regression tests unchanged
        env:
          APPROVED: ${{ contains(github.event.pull_request.labels.*.name, 'regression-change-approved') }}
          BASE: ${{ github.event.pull_request.base.sha }}
          HEAD: ${{ github.event.pull_request.head.sha }}
        run: |
          changed=$(git diff --name-status --diff-filter=DMR "$BASE...$HEAD" -- ':(icase)*regression*')
          if [ -n "$changed" ] && [ "$APPROVED" != true ]; then
            printf 'Frozen regression tests changed; the user adds the regression-change-approved label to accept:\n%s\n' "$changed"
            exit 1
          fi
```

- `labeled` and `unlabeled` rerun the check when the label changes. With the
  default types (`opened`, `synchronize`, `reopened`) it stays red after the
  user approves.
- `fetch-depth: 0` fetches the base and head commits the three-dot diff needs.
- The label and the SHAs reach the script through `env`, never interpolated
  into `run`, so a crafted label name cannot inject shell.
- A rename to a name without `regression` shows as `D`, so it fails too.
- The pathspec matches anywhere in the path. In a project whose source files
  also say regression (a statistics library), narrow it to the test root, for
  example `':(icase)tests/*regression*'`.

Create the label once, after asking the user in a repo they do not own:

```sh
gh-axi label create --name regression-change-approved --color d93f0b --description "User accepts a change to a frozen regression test"
```

The red check blocks the merge only when branch protection lists it as
required, and that setting is the user's call.

## Other CI

Same contract: diff the PR's merge base against its head, keep only paths that
contain `regression`, fail on deleted, modified or renamed entries, and pass
when the PR carries the approval marker.
