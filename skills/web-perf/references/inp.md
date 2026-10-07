# INP: Interaction to Next Paint

Read when field INP is poor, an interaction trace shows a slow interaction, or `INPBreakdown`, `ForcedReflow`, `DOMSize`, or `ThirdParties` flags main-thread cost.

A load trace has no INP.
Record one with `chrome-devtools-axi perf-start --no-reload --no-auto-stop`, perform the interaction (`click`, `type`, `press`), then `perf-stop`, and query `perf-insight NO_NAVIGATION INPBreakdown`.
Use a representative CPU profile (`emulate --cpu 4` for mid-range mobile).

## Diagnose the phase first

| Phase | Evidence | Typical fix |
|-------|----------|-------------|
| Input delay | Long tasks already on the main thread before the callback starts | Cut startup work, split long tasks, delay third parties |
| Processing | Event callbacks and the synchronous work they trigger | Remove work, simplify handlers, move CPU-heavy work to a Web Worker |
| Presentation delay | Style, layout, paint, or later work before the next frame | Shrink DOM scope (`DOMSize`), avoid layout invalidation (`ForcedReflow`) |

Optimize the handler only after the trace shows which phase dominates.

## Yield long work

```javascript
async function processLargeArray(items) {
  for (let i = 0; i < items.length; i += 100) {
    items.slice(i, i + 100).forEach(expensiveOperation);
    if (globalThis.scheduler?.yield) await scheduler.yield();
    else await new Promise((r) => setTimeout(r, 0));
  }
}
```

Choose chunk boundaries from the trace; a fixed item count does not guarantee short tasks on slow devices.

## Paint feedback before deferred work

```javascript
button.addEventListener('click', async () => {
  button.classList.add('loading');
  if (globalThis.scheduler?.yield) await scheduler.yield();
  else await new Promise((r) => setTimeout(r, 0));
  updateUI(calculateComplexThing());
  if ('requestIdleCallback' in window) requestIdleCallback(() => trackEvent('click'));
  else setTimeout(() => trackEvent('click'), 0);
});
```

Yielding helps only when the visual update can paint before the remaining work; confirm the frame in the trace.
In React, `startTransition` marks non-urgent state updates so urgent input renders first.

## Common causes

- **Forced reflow**: reading layout (`offsetHeight`, `getBoundingClientRect`) after a style write in the same task. Batch all reads, then all writes; schedule visual writes in `requestAnimationFrame`.
- **Large DOM**: virtualize long lists, or apply `content-visibility: auto` with `contain-intrinsic-size` to off-screen sections.
- **Third-party code**: attribute long tasks to script URLs; delay non-essential widgets, but give visible feedback if the first interaction pays their init cost.
- **Framework rendering**: profile the affected state transition; memoize only where the trace shows repeated work.
- **High-frequency handlers**: debounce or throttle scroll, resize, and input handlers that do layout or network work.
- **CPU-heavy computation**: move it to a Web Worker and measure the serialization cost.

## Inspect one session (lab only)

```javascript
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    if (e.duration > 200) console.warn('Slow interaction', {
      type: e.name, duration: e.duration,
      processingStart: e.processingStart, processingEnd: e.processingEnd, target: e.target,
    });
  }
}).observe({ type: 'event', buffered: true, durationThreshold: 40 });
```

For production attribution use `onINP()` from `web-vitals/attribution`; see [rum.md](rum.md).

## Verify

- [ ] Interaction reproduced on a representative CPU profile
- [ ] Dominant phase identified and its owning first- or third-party task named
- [ ] Visible feedback paints before deferred work where appropriate
- [ ] Same interaction and conditions re-traced after the fix
- [ ] Field improvement claimed only after new RUM or CrUX visits

Sources: [Optimize INP](https://web.dev/articles/optimize-inp), [`scheduler.yield()`](https://web.dev/articles/optimize-long-tasks#scheduler-yield).
