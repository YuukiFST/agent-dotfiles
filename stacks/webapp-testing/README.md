# webapp-testing

Playwright toolkit for driving a local web app: navigate, fill, click, screenshot, read console logs.
Ships helper scripts (`scripts/with_server.py`, `scripts/screenshot.py`) plus examples.

## Why archived

`agent-browser` covers the same ground on this machine — one browser CLI is enough, and two
Playwright skills both claiming "test the running web app" make the harness pick badly.
Archiving it also keeps it off the disk entirely: `stacks/` is excluded from the sparse clone
the bootstrap scripts create, so the skill is kept in the repo without ever being downloaded.

## Cost of re-enabling

One skill's frontmatter per turn, plus a Playwright install (`pip install playwright && playwright install chromium`)
on any machine that actually runs it.

```bash
bash scripts/stack.sh enable webapp-testing
bash scripts/sync-config.sh claude   # or: pwsh -File scripts/sync-config.ps1 all
```

No `CLAUDE-snippet.md`: `CLAUDE.md` never referenced this skill, so nothing has to be pasted back.
