# Frontend decisions

Read when a `dev` ticket decides how a web frontend renders, holds state, talks to the network or fails.
Answer each row that applies in the ticket's **Decision**.
An answer that changes what a user lives through (working offline, losing typed work, seeing old data) fails the [experience test](SKILL.md#the-experience-test) and is a `po` ticket.

## Rendering

- **Where the HTML is made, per route:** in the browser, on the server per request, at build, rebuilt on a timer, or streamed.
- **Navigation:** a new document per page, or a client router.
- **Composition:** one deployable frontend, or several owned by different teams.
- **API seam:** the browser calls each service, or one backend shaped for this frontend; REST or GraphQL.
- **Live data:** polling, server-sent events or a WebSocket, picked by direction and frequency.
- **Heavy surface:** DOM, Canvas or WebGL.
- **Search and filtering:** on the client or the server, picked by the size of the set.

## State

- **One source of truth per piece of data,** filed as server data held in a cache, client state, or state of one view.
- **Where each lives:** in the URL when a shared link must restore it, in storage when it survives a refresh, in memory otherwise.
- **Cache:** how long each resource stays fresh, what invalidates it, and which may be shown stale while it refetches.
- **Optimistic writes:** which writes show before the server answers, and how each is confirmed or rolled back.
- **Lists:** cursor pagination where rows arrive while the user pages.
- **Derived values** are computed from their source, never stored beside it.

## Network

- **Retries:** only a request that is safe to repeat, with backoff and a cap.
- **Two kinds of failure:** the request never arrived, or the server refused it; the interface tells them apart.
- **Unwanted answers:** a request whose answer no longer matters is cancelled, typing that triggers requests is debounced, and identical requests in flight share one call.
- **Live connection:** when it reconnects, what it refetches after a gap, how out-of-order events are placed, and who wins when two people edit the same thing.

## Failure

- **One region fails alone:** the rest of the page still renders.
- **The connection drops:** what stays usable, and what the user is told.
- **Unsaved work:** a draft survives a refresh or a crash.
- **Old client, new server:** what a tab opened before a deploy does on its next request.
- **Risky feature:** a flag that turns it off without a deploy.

The states each screen must draw belong to `ui-polish`, speed targets to `perf-ratchet`, and auth, tokens and untrusted input to `security-audit`.
