---
name: principle-error-design
description: "Apply when adding or changing an error: its type, message, public shape, status code or retry guidance. Say what failed and why, end on a way forward, carry typed context, keep reassurance provable, and translate each failure deliberately at the boundary."
---

# Error design

An error is an interface. A human or an agent reads it to choose the next action, and an operator searches it to find the trace behind it. An error that hides what failed, or promises what the code cannot prove, sends both the wrong way.

**Every error:**

- **What failed and why.** Name the operation and the most specific safe reason known. Safe means no secrets, internals or vendor detail, and no answer to "does this account exist": login, password reset and existence checks reply the same way whatever the cause. Generic copy ("Something went wrong") is only for a cause the code has not classified.
- **Typed context, not prose.** Carry the operation, safe domain IDs, a classified reason and field violations as fields, so an operator filters instead of parsing text.
- **Searchable.** The message opens with a specific phrase, so grep leads from a log line to the line that raised it.
- **A way forward at the edge.** Inner layers add context only (`open config: read file: permission denied`). The outermost error, the one a person or caller reads, ends on one next action: correct the named input, retry, inspect or reconcile the named resource, or escalate.
- **Provable reassurance.** Say "nothing changed" only when the failed operation could not have committed. After a non-atomic operation, say the outcome is uncertain and point at the read that settles it.
- **Deliberate translation.** At each boundary, match every known variant by name with no default arm ([Type System Discipline](../principle-type-system-discipline/SKILL.md)), so a new variant forces a decision on its message, status and recovery. One outermost handler catches what nothing classified: it logs the cause internally and returns the generic error.
- **Calm, direct tone.** Plain domain words, no apology, the problem described rather than the caller or a vendor blamed. User-facing wording follows the Microcopy section of [`ai-copywriter`](../ai-copywriter/SKILL.md).

**A service's public errors add:**

- **The project's envelope first.** Follow the error shape the project already serves (problem+json, gRPC status, its own JSON). A missing field is a proposal in the report, not a change to one error; a shape change is a breaking change, and the report names it.
- **Two audiences.** Internal errors keep the cause and the downstream call that failed. Public errors carry a stable literal code, a message, safe details shaped per variant, a request ID and a truthful `retryable`; credentials, tokens, raw bodies, SQL, stack traces and vendor responses stay internal. Redaction keeps the operation and any opaque domain ID the caller sent.
- **Truthful retry.** `retryable` is true only when the cause is transient and repeating the call cannot apply a partial write twice or start a second logical operation ([Make Operations Idempotent](../principle-make-operations-idempotent/SKILL.md)).
- **Status from meaning.** Pick the HTTP status from what the caller can do: 400 correctable input, 401 unauthenticated, 403 authenticated but not permitted (404 when existence itself is secret), 404 unknown but well-formed ID, 409 state conflict, 500 broken invariant or non-transient internal failure, 503 a capability temporarily down.

**The tests:**

- "Can a caller act on the outermost error without reading the source?" If not, it lacks a way forward.
- "Is `retryable: true` still true if the first attempt partly committed, or if the caller's input caused the failure?" If not, it is false.
- "Does a known variant fall into the generic handler?" Give it its own translation.
- "Can an operator get from this public error to its trace?" If not, add the request ID.
- "Could this message carry a secret, a query or a vendor body, or reveal whether an account exists?" Move that to the internal error.

Adapted from [cf-workflow-pool `docs/errors.md`](https://github.com/dmmulroy/cf-workflow-pool/blob/main/docs/errors.md), which draws on ["When life gives you lemons, write better error messages"](https://wix-ux.com/when-life-gives-you-lemons-write-better-error-messages-46c5223e1a2f).
