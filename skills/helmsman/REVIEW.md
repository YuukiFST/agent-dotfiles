# Review

Reached from `/helmsman <map> --review`.

Drains **every** open `po` ticket through [packets](PACKET.md).
The three-packet cap is charting's; a review sends as many as its queue needs, because every ticket in it already passed the ask test.

1. Load the map and query all open `po` tickets. Order them: blockers first, then whatever unblocks the most `dev` tickets.
2. Send them as packets, with each escalation's recommendation selected, plus the **Assumed** lines and technical decisions added since the last packet.
3. Apply each packet per [PACKET.md](PACKET.md) as it lands, so an interrupted session still banks it.
4. When the queue is empty, refresh **Waiting on you** to empty, tell them what just unblocked ("that unblocks <n> technical questions, and I'll work through them alone"), and hand over [the next command](SKILL.md#the-next-command).
