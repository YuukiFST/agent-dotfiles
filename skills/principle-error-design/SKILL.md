---
name: principle-error-design
description: "Apply when adding or changing an error: its type, message, public shape, status code or retry guidance. Say what failed and why, end on a way forward, carry typed context, keep reassurance provable, and translate each failure deliberately at the boundary."
---

# Error design

An error is an interface. A human or an agent reads it to choose the next action, and an operator searches it to find the trace behind it. An error that hides what failed, or promises what the code cannot prove, sends both the wrong way.

**The pattern:**

- **What failed and why.** Name the operation and the most specific safe reason known. Generic copy ("Something went wrong") is only for a cause the code has not classified.
- **A way forward.** Every error ends on one next action: correct the named input, retry the same operation, inspect or reconcile the named resource, or contact support with the request ID.
- **Retry guidance follows idempotency.** Mark an error retryable only when repeating the call cannot apply a partial write twice or start a second logical operation.
- **Provable reassurance.** Say "nothing changed" only when the failed operation could not have committed. After a non-atomic operation, say the outcome is uncertain and point at the read that settles it.
- **Typed context, not prose.** Carry the operation, safe domain IDs, a classified reason, field violations and retryability as fields. A public error pairs a stable literal code with a details shape per variant, so code and details cannot disagree.
- **Searchable.** The message opens with a specific phrase and the code is a literal, so grep leads from a log line to the line that raised it.
- **Two audiences.** Internal errors keep the cause and the failing capability for traces. Public errors carry code, message, safe details, request ID and a truthful `retryable`; credentials, tokens, raw bodies, SQL, stack traces and vendor responses stay internal. Redaction keeps the operation and the requested ID.
- **Deliberate translation.** At each boundary, translate every known error variant by name and leave a new variant unhandled, so the compiler forces a decision on its code, message, status and recovery. A catch-all quietly turns next month's failure into a generic response.
- **Status from meaning.** Pick the HTTP status from what the caller can do: 400 correctable input, 401 unauthenticated, 404 unknown but well-formed ID, 409 state conflict, 500 broken invariant or non-transient internal failure, 503 a capability temporarily down.
- **Calm, direct tone.** Plain domain words, one apology at most, the problem described rather than the caller or a vendor blamed, implementation names kept to internal errors.

**The tests:**

- "Can a caller act on this error without reading the source?" If not, it lacks a way forward.
- "Is `retryable: true` still safe if the first attempt partly committed?" If not, it is false.
- "Does any branch map an error type added next month to a generic 500?" Replace it with per-variant translation.
- "Can an operator get from this public error to its trace?" If not, add the request ID.
- "Could this message carry a secret, a query or a vendor body?" Move that to the internal error.

Adapted from [cf-workflow-pool `docs/errors.md`](https://github.com/dmmulroy/cf-workflow-pool/blob/main/docs/errors.md), which draws on ["When life gives you lemons, write better error messages"](https://wix-ux.com/when-life-gives-you-lemons-write-better-error-messages-46c5223e1a2f).
