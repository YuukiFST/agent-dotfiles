# Coverage

Read in phase 7, after the dominant bottleneck is traced.
The trace names the worst problem; this table keeps the audit from stopping there.

Answer every row in the report with one of:

- **Finding**: the evidence and its measured cost, ranked with the rest.
- **Clean**: the evidence that shows it (the request list, the insight, the count).
- **Not applicable**: the reason (no lists, no images, static page).
- **Not measured**: what was missing (no source access, no interaction, no backend).

A row with no measured cost gets a note, never a recommendation, per the Judgment rules.

## Delivery

| Area | Check | Evidence |
|------|-------|----------|
| JS bundle size | Compressed JS the route loads against the budget | `network --type script`; [codebase.md](codebase.md) budgets |
| Bundle splitting, route-based loading | Code for other routes or rarely opened components in the entry chunk; routes and heavy components behind `import()` | Bundler stats or analyzer; script list on two different routes |
| Tree shaking | Whole-library and barrel imports, `sideEffects`, two versions of one package | `DuplicatedJavaScript`; [codebase.md](codebase.md) |
| Legacy code and polyfills | Transpiled or polyfilled code shipped to modern browsers | `LegacyJavaScript`; [codebase.md](codebase.md) |
| Prefetching | The next likely navigation's document and chunks fetched ahead; prefetches nobody uses | `network --type prefetch`; [lcp.md](lcp.md), Speculation Rules |
| Preload, priority, preconnect | LCP resource and critical fonts discovered early; no unused preconnect | `LCPDiscovery`, `NetworkDependencyTree` |
| Image optimization | Format, dimensions against rendered size, lazy loading below the fold only | `ImageDelivery`; [lcp.md](lcp.md) |
| Font loading | Font bytes, families and weights on the first screen, swap behavior, subsetting | `FontDisplay`, `network --type font`; [lcp.md](lcp.md) |
| CSS | Render-blocking and unused CSS | `RenderBlocking`; [codebase.md](codebase.md) |
| Third parties | Bytes and main-thread time per origin | `ThirdParties` |
| Server response | TTFB, redirects, text compression, HTTP version | `DocumentLatency`, `ModernHTTP` |
| Caching layers | Each layer answers for what it should: browser HTTP cache (lifetimes on hashed assets), CDN (hit or miss on the document and assets), service worker, in-app data cache (one request issued twice in a flow), server cache | `Cache` insight; `network-get` response headers; a repeat-visit trace |

## Runtime

| Area | Check | Evidence |
|------|-------|----------|
| Main-thread blocking | Long tasks during load and during the main interaction | TBT, `INPBreakdown`; [inp.md](inp.md) |
| Worker offloading | Pure computation over 50 ms in a handler or at startup (parsing, sorting, search, encoding) | The long task's call tree in the interaction trace |
| Over-rendering | Components rendering when their inputs did not change; one state update rendering an unrelated subtree | Render counts from the framework's profiler on the traced interaction |
| Memoization | The same expensive computation repeated with the same input | Repeated calls in the trace; memoize only there |
| Virtualization | Long lists and tables rendered whole | `DOMSize`; row count in the DOM against rows on screen |
| Layout thrash | Layout read after a style write | `ForcedReflow` |
| Layout shifts | Unsized media, injected content, font swap | `CLSCulprits`; [cls.md](cls.md) |
| Dropped frames | Scroll and animations holding the refresh rate; animations on properties that skip layout and paint | Frame counter during a scripted scroll, per `perf-ratchet`'s [metrics.md](../../perf-ratchet/metrics.md) |
| Hydration and rendering mode | Time between the HTML arriving and the page responding; client work a server render would remove | LCP render delay subpart; long tasks after first paint |
| Memory usage | Heap after the main flow; heap growth and detached nodes after repeating it | `chrome-devtools-axi heap`, per `perf-ratchet`'s [metrics.md](../../perf-ratchet/metrics.md) |
| Idle work | Timers, polling and sockets running with nothing on screen changing | Network log and trace of an idle minute |

## Backend and reliability

| Area | Check | Evidence |
|------|-------|----------|
| API latency | Each request the page waits on, against what the user waits for | `network --type fetch`, timing from `network-get` |
| Request shape | Requests in sequence that could run together; one request per list item; payload fields the page never reads | Order and count in the network log |
| Error rate | Console errors and failed requests during the flow; in production, errors per session next to the vitals | `console --type error`, statuses in the network log; [rum.md](rum.md) |

Any row that turns into a number worth holding goes to `perf-ratchet`'s web checklist, so the fix stays fixed.
