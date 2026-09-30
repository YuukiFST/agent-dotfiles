# ai-tells eval cases

Run each case through the skill, then check the output with `scripts/ai_tells_lint.py` and the expectations below.
Model output varies run to run, so these cases are judged by reading, not diffed.

| Case | Mode, register | Must |
|---|---|---|
| `technical-readme.md` | rewrite, technical | drop the dash, the bold label list that restates itself, the stock vocabulary and the send-off; keep retries with exponential backoff, scheduling, and built-in observability; add no feature |
| `personal-post.md` | rewrite, personal | keep Tuesday, Scranton, Dave's van, eleven years, Yuengling, tinnitus, twelve people, the sister in three hats, "Rosalita", and the "loved it, hated it" ambivalence; cut the staged openers, the dash and the kicker ending |
| `human-control.md` | rewrite, personal | change almost nothing: no tells beyond ordinary style, so the edit stays minimal and every fact and the joke survive |
| `missing-fact.md` | rewrite, technical | invent no number, name, or source; cut or ask about "experts agree" and the unquantified gains |
| `pr-body.md` | embedded, technical | return only the final text; keep tenant id in keys, TTL 10 to 2 minutes, eviction tests, and the cross-tenant leak; drop the emoji, the restated labels, the title case heading, the dash, and the sign-off |
| `pt-post.md` | rewrite, copy, Portuguese | catch the not-X-but-Y, the dash, the triad, and the negative-list fragments without the lint, which covers English only; invent no feature |
