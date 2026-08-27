#!/usr/bin/env python3
"""Measure whether the instructions in rules/ and CLAUDE.md are actually followed.

Reads Claude Code session transcripts and counts observable signatures of each rule.
A hit means the transcript shows the behaviour a rule asks for. It does NOT prove the
rule caused it - see docs/rules-audit-baseline.md for what these numbers can and
cannot support. (Plain hyphen on purpose: this docstring prints to the console via
--help, and the Windows console mangles an em dash.)

    python scripts/rules-audit.py --since 2026-08-01
    python scripts/rules-audit.py --since 2026-09-01 --json > run.json
"""
import argparse
import json
import os
import re
import sys
from collections import Counter

DEFAULT_ROOT = os.path.expanduser("~/.claude/projects")

# --- prompting.md signatures, measured on the prompt a subagent was launched with ---
SIGNATURES = {
    # §Structure + §2 delimiters: task stated up front, or sections marked off
    "structure": re.compile(r"^\s*(TASK|#\s|##\s|<[a-z_]+>)", re.M),
    # §3 output format upfront
    "output_fmt": re.compile(
        r"output (format|only|the)|report (only|findings|back)|return (only|a|the)|"
        r"just the diff|JSON only|respond with|format:|one line per|file:line",
        re.I,
    ),
    # §5 anti-hallucination guardrails
    "guardrail": re.compile(
        r"if (you are |you're )?uncertain|state if|say so|cite|verified versus|"
        r"rather than guess|do not guess|don't guess|insufficient|plainly rather than|"
        r"what you verified|explicit about what",
        re.I,
    ),
    # §4 few-shot
    "fewshot": re.compile(r"<example>|for example:|e\.g\.|example:", re.I),
}

# --- signatures visible in Bash commands, for CLAUDE.md and git.md rules ---
BASH_PATTERNS = {
    "git-history-as-tool": re.compile(r"\bgit (log|blame|show)\b"),
    "gh-cli-over-mcp": re.compile(r"\bgh-axi\b|\bgh (pr|issue|api|run|repo)\b"),
    "issue-before-code": re.compile(r"issue create"),
    "branch-per-issue": re.compile(
        r"(checkout -b|switch -c)\s+\S*(feat|fix|docs|chore|refactor|test|ci|perf|style)/"
    ),
    "commit": re.compile(r"git commit|git-safe-commit"),
    "pr-created": re.compile(r"pr create"),
}

# A rule with zero opportunities to fire was not obeyed — it was untested. Counting the
# opportunity separately is what keeps "0 violations" from reading as success.
MCP_CALL = re.compile(r'"name":\s*"mcp__')


def iter_lines(path):
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            yield line


def launch_prompt(path):
    """A subagent transcript opens with the prompt its parent sent."""
    for line in iter_lines(path):
        try:
            rec = json.loads(line)
        except ValueError:
            continue
        if rec.get("type") != "user":
            continue
        content = rec.get("message", {}).get("content")
        if isinstance(content, str):
            return content, rec.get("timestamp", "")
        if isinstance(content, list):
            parts = [
                b.get("text", "")
                for b in content
                if isinstance(b, dict) and b.get("type") == "text"
            ]
            if parts:
                return "\n".join(parts), rec.get("timestamp", "")
        return None, None
    return None, None


def audit(root, since):
    stats = Counter()
    sessions = set()
    weak = []

    for dirpath, _dirs, files in os.walk(root):
        is_subagent = os.path.basename(dirpath) == "subagents"
        for name in files:
            if not name.endswith(".jsonl"):
                continue
            path = os.path.join(dirpath, name)

            if is_subagent:
                text, ts = launch_prompt(path)
                if not text or (ts or "") < since:
                    continue
                stats["prompt_total"] += 1
                hits = {k: bool(rx.search(text[:400] if k == "structure" else text))
                        for k, rx in SIGNATURES.items()}
                for key, hit in hits.items():
                    if hit:
                        stats["prompt_" + key] += 1
                if not hits["output_fmt"] and not hits["guardrail"]:
                    stats["prompt_neither"] += 1
                    weak.append(path)
                continue

            for line in iter_lines(path):
                if MCP_CALL.search(line):
                    stats["mcp_calls"] += 1
                if '"name":"Bash"' not in line and '"name": "Bash"' not in line:
                    continue
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                if (rec.get("timestamp") or "") < since:
                    continue
                sessions.add(rec.get("sessionId"))
                content = rec.get("message", {}).get("content")
                if not isinstance(content, list):
                    continue
                for block in content:
                    if not isinstance(block, dict) or block.get("name") != "Bash":
                        continue
                    cmd = (block.get("input") or {}).get("command", "")
                    stats["bash_total"] += 1
                    for label, rx in BASH_PATTERNS.items():
                        if rx.search(cmd):
                            stats[label] += 1

    total = stats["prompt_total"] or 1
    return {
        "window": {"since": since, "root": root},
        "corpus": {
            "subagent_prompts": stats["prompt_total"],
            "sessions_with_bash": len(sessions),
            "bash_calls": stats["bash_total"],
        },
        "prompting_md": {
            key: {
                "hits": stats["prompt_" + key],
                "pct": round(100.0 * stats["prompt_" + key] / total),
            }
            for key in SIGNATURES
        },
        "prompting_md_neither_output_nor_guardrail": {
            "hits": stats["prompt_neither"],
            "pct": round(100.0 * stats["prompt_neither"] / total),
        },
        "bash_signatures": {k: stats[k] for k in BASH_PATTERNS},
        "mcp_calls": stats["mcp_calls"],
    }, weak


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--since", default="2026-08-01",
                    help="ISO date; transcripts older than this are skipped")
    ap.add_argument("--root", default=DEFAULT_ROOT,
                    help="Claude Code projects directory")
    ap.add_argument("--json", action="store_true",
                    help="machine-readable only; suppress the weak-prompt list")
    args = ap.parse_args()

    if not os.path.isdir(args.root):
        sys.exit("no transcripts at %s" % args.root)

    result, weak = audit(args.root, args.since)
    print(json.dumps(result, indent=2))

    if not args.json and weak:
        print("\n%d prompts stated neither an output format nor a guardrail:"
              % len(weak), file=sys.stderr)
        for path in weak[:15]:
            print("  " + path, file=sys.stderr)


if __name__ == "__main__":
    main()
