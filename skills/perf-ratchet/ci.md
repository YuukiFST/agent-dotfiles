# CI gate for stable metrics

Shared CI runners change CPU model and load between jobs, so a timing baseline from one job judges nothing in the next.
CI gates only `stable` metrics; timing, RAM, CPU and FPS stay on the local gate in SKILL.md.

## Cost

GitHub-hosted runners are free in public repositories.
In a private repository the job spends the account's included Actions compute, and usage is blocked when it runs out unless a payment method and budget allow more (docs.github.com, "GitHub Actions billing").
Keep the job on `ubuntu-latest` (the cheapest runner), filtered to the paths that change the measured artifacts, and capped with `timeout-minutes`.
Before adding it to a private repository, tell the user it spends included minutes, and add it only when they agree.

## Workflow

Write `.github/workflows/perf-ratchet.yml`, with the build and paths matching the project:

```yaml
name: perf-ratchet
on:
  pull_request:
    paths: ["src/**", "package.json", "package-lock.json", ".perf/**"]
jobs:
  stable-metrics:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run build
      # Only when a stable metric uses count.mjs:
      - run: sudo apt-get update && sudo apt-get install -y valgrind
      - run: node .perf/bin/ratchet.mjs measure --stable-only
      - run: node .perf/bin/ratchet.mjs check --stable-only --no-promote
```

`--no-promote` keeps CI read-only: an improvement passes and is promoted by the local gate, whose `baselines.json` change rides in the same PR.
A stable metric with no baseline yet passes as `new`; the local gate records it.
A `platforms: ["linux"]` metric is promoted only where it runs: on a Windows machine, run `measure --only <id>` and `check --only <id>` inside WSL, or its baseline never moves.
