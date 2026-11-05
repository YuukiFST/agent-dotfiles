# Running under firstmate

`FM_TASK_ID` in the environment means this session is a firstmate worker.
The first mate is the only one who talks to the captain, so a worker never addresses the human: every "tell the human" and "ask the human" in this skill becomes the routing below.
The task's brief outranks this file; each command's exact form comes from the brief, because it carries this home's paths.

## Phases to tasks

| Helmsman | Firstmate | Notes |
|---|---|---|
| Chart, Advance, Review, Design | one **scout** | a scout's worktree is discarded, so all output goes to the plan branch or the tracker |
| Plan PR | the scout promoted to **ship** | landing it is the captain's approval of the plan |
| Each build ticket | one **ship** the first mate dispatches | one worker, one ticket |

Skip [BUILD.md](BUILD.md) here: the first mate dispatches the tickets, and each ship follows its project's delivery path instead of `--build`'s integration branch and `/interrogate`.
A ship still takes its UI rules from [BUILD.md](BUILD.md#interface-tickets).

## Records

On a local tracker, the map and tickets go in `<plan>/tracker/` on the plan branch in place of `.scratch/<effort>/`, committed at every clean ticket boundary.
Push the plan branch whenever the brief's delivery mode allows it, because the worktree does not outlive the task.

## Packets

Steps 3 and 4 of [PACKET.md](PACKET.md) change; the page itself does not.

1. Open the artifact with `lavish-axi <file>`.
2. Arm the board with `bin/fm-procevent-lavish.sh arm <artifact.html> --for $FM_TASK_ID`. The board's listener belongs to that script, so skip `lavish-axi poll`.
3. Append `needs-decision [key=board-review]` with the live board URL to the status file, then end the turn. The answer arrives as your next turn.
4. Bank and apply the answers as usual, then re-arm with `--agent-reply-file` to acknowledge the round.
5. On `session_ended` or an empty End, acknowledge with `bin/fm-procevent.sh handled <source-id> <sequence>`.

When the brief says Lavish is unavailable, write the open items into the report instead and raise one `needs-decision` line.
One packet is one decision key, however many questions it holds, so the captain gets one board and not a queue of asks.

## The next command

[The next command](SKILL.md#the-next-command) goes to the first mate, not the human: end with the status line, and the phase that command names in `done`.
When the plan is complete, list the unblocked build tickets by title and URL in the report, in dependency order, so the first mate can file them as tasks.
