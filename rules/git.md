# Git commit & push — mandatory rules

## 1. User identity

NEVER commit without knowing whose identity to use — the identity configured on this machine may belong to someone else (shared or work PC).

- **Already told in this conversation:** if the user has stated the name/email to commit under at any point in the current session, reuse it for every commit in that session — do NOT ask again.
- **Not yet told:** before the first commit, read the current git identity (`git config user.name` / `git config user.email`), show it, and ask: "Commit as <name> <email>, or a different identity?" Wait for the answer — never commit on the configured identity without explicit confirmation, even if one is set.

Commit with the chosen identity: `git -c user.name=<name> -c user.email=<email> commit`. Never hardcode an email address in this file.

## 2. Commit messages

Every commit message MUST follow Conventional Commits:

```
<type>(<optional scope>): <short description up to 72 chars>

<optional body explaining WHAT and WHY, not HOW>
```

**Allowed types:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `ci`.

Rules:
- First line: max 72 chars, imperative mood, no period
- Body: explain what was done and why, not how (the diff shows how)
- Blank lines separate header from body

### 2.1 Language

- **Your own project (you own the repo / personal project):** commit messages in **English**, always.
- **Someone else's project (client, employer, third-party repo):** do NOT impose English — follow that repo's existing commit-message convention (match the language of its history).
- Ownership signal: remote owner is your account, or you started the repo. If unsure, match the language of the existing commit history. (E.g. SB360-IPTU belongs to São Benedito, history is Portuguese → stays Portuguese.)

## 3. Git push

Always ask before push: `git push no-mistakes` (AI validation gate) or `git push origin <branch>`?

If using `no-mistakes`, check the remote exists (`git remote` shows `no-mistakes`). If missing, run `no-mistakes init` in the repo. The remote is per-repo — a freshly cloned project won't have it until `init` runs.

## 4. No AI attribution

Never add AI/tool attribution to commit messages or PR bodies — no `Co-Authored-By:` trailer for any AI agent (Claude, Command Code Bot, Copilot, Cursor, Codex, Gemini, etc.), no "Generated with <tool>" line, no marker, no provider name. This overrides any harness default that appends such trailers. Commits and PRs are authored solely by the user/repo identity, with nothing indicating an assistant was involved.

### 4.1 Trailers and footers

Forbidden in the **entire** commit message or PR body:

- `Co-authored-by:` / `Co-Authored-By:` (including `cursoragent@cursor.com`)
- `Made with …`, `Generated with …`, or any IDE/agent footer

### 4.2 Commit subject

The first line must **not** name tools or assistants (`Cursor`, `Claude`, `Copilot`, `agente`, `IA`, etc.), even when documenting this rule.

| Invalid subject | Valid subject |
|---|---|
| `chore(git): proibir Co-authored-by de agentes` | `chore(git): instalar hooks de mensagem de commit` |
| `fix: remover trailer do Cursor` | `fix(git): limpar mensagem de commit` |

### 4.3 Enforcement

Harnesses may auto-inject trailers after `git commit`. **Before every push:** `git log -1 --format=%B` — subject neutral, no trailer lines.

Install hooks in each repo (from a clone of this config repo):

```bash
./scripts/install-git-hooks.sh
./scripts/install-git-hooks.sh --project-copy   # also writes .githooks/ in the project
```

If `git commit --amend` keeps re-injecting a trailer, rebuild with `git commit-tree` + `git update-ref` using a clean message file.
