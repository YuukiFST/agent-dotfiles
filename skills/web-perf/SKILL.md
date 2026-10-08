---
name: web-perf
description: Measure and fix website performance - slow page loads, Core Web Vitals (LCP, INP, CLS), Lighthouse or PageSpeed scores, sluggish interactions, layout shifts, heavy bundles. Use for a performance audit of a URL or a web codebase, or to verify a performance fix before and after. Desktop app launch time belongs to optimizing-startup.
license: Apache-2.0 AND MIT (see LICENSE)
---

# Web performance

Measure first, fix the dominant bottleneck, re-measure under the same conditions.
Every number you report carries its evidence type: **field**, **lab**, or **hypothesis**.

## Retrieval over memory

Thresholds, insight names, browser support, and framework APIs drift; your pre-training may be stale.
Retrieve before citing a number or an API you are not reading from a tool's output right now.

| Source | Use for |
|--------|---------|
| `https://web.dev/articles/vitals` | Core Web Vitals definitions and thresholds |
| `https://developer.chrome.com/docs/performance/insights` | What each trace insight means |
| `https://developer.chrome.com/docs/lighthouse/performance/performance-scoring` | Lighthouse metric weights and scoring curves |
| `https://developer.chrome.com/docs/crux` | CrUX scope, eligibility, API |
| context7 (`resolve-library-id`, `query-docs`) | Framework image, font, script, and rendering APIs (Next.js, Nuxt, Astro, SvelteKit) |

## Evidence types

| Type | Source | Decides |
|------|--------|---------|
| **field** | CrUX or first-party RUM, aggregated real users at p75 | Whether users have a problem; pass/fail priority |
| **lab** | One trace or Lighthouse run under stated conditions | Which cause dominates; whether a fix worked |
| **hypothesis** | Source inspection with nothing running | Nothing yet; always paired with the measurement that confirms it |

- A `PerformanceObserver` snippet run in one page is **lab**, not field.
- Missing CrUX data is **unavailable**, never passing. Localhost, staging, new, private, and low-traffic pages usually have none.
- Origin-scope CrUX is labeled origin: context for a route, not proof about it.
- Keep phone and desktop data separate.
- A single lab value and a field p75 are different samples; never compare them as equivalent.
- Metric values are the evidence. A Lighthouse score is a versioned weighted summary.

| Field | Lab | Interpretation |
|-------|-----|----------------|
| Poor | Poor | Reproducible user problem: trace and fix the dominant bottleneck |
| Poor | Good | Lab missed real conditions: segment RUM, test representative devices, routes, cache states, interactions |
| Good | Poor | Cold or throttled case is fragile; users are not currently failing |
| Unavailable | Any | Diagnose with lab; recommend RUM if production impact matters |

## Judgment

- **Assertive.** Verify a claim against the network log, DOM, or code, then state it definitively. When unsure, measure instead of hedging.
- **Verify before removing.** Confirm a resource is unused before recommending removal. An origin with zero requests makes its preconnect unused; requests that arrive late mean the preconnect may still help.
- **Rank by measured impact.** Use insight estimated savings and LCP subpart shares. An item with 0 ms estimated savings gets a note, not a recommendation.
- **Specific.** "Serve hero.png (450 KB) as AVIF at 1200w", never "optimize images".
- **Excellent is a finding.** A page with 200 ms LCP and 0 CLS is excellent; say so and stop.
- **Scoped edits.** Change only code and assets tied to a measured bottleneck.
- **Preload sparingly.** Preload only what the trace shows discovered late; every preload competes for bandwidth with the LCP resource.

## Thresholds

Core Web Vitals, judged at p75 of page visits; a route passes only when all three are good.

| Metric | Good | Poor |
|--------|------|------|
| LCP | ≤ 2.5 s | > 4 s |
| INP | ≤ 200 ms | > 500 ms |
| CLS | ≤ 0.1 | > 0.25 |

Diagnostics, not Core Web Vitals:

| Metric | Good | Poor | Note |
|--------|------|------|------|
| TTFB | ≤ 800 ms | > 1.8 s | web.dev guidance |
| FCP | ≤ 1.8 s | > 3 s | web.dev guidance |
| TBT | 200 ms | 600 ms | Lighthouse mobile scoring points (score 90 / 50); lab proxy for INP, never field INP |
| Speed Index | 3.4 s | 5.8 s | Lighthouse mobile scoring points (score 90 / 50) |

## Workflow

Copy this checklist and tick it as you go:

```
- [ ] 1 Scope
- [ ] 2 Field baseline
- [ ] 3 Lab trace
- [ ] 4 Insights
- [ ] 5 Network
- [ ] 6 Codebase (skip without source access)
- [ ] 7 Fix and verify
```

### 1 Scope

Record the exact URL and page state (public, authenticated, local, staging), whether you have the codebase, and the target form factor.
Default to mobile; add desktop when asked or when the product is desktop-oriented.
Trace authenticated and anonymous states separately when they render different pages.
Nothing runnable: skip phases 2-5, run phase 6, and label every finding **hypothesis**.

### 2 Field baseline

The trace summary in phase 3 prints `Metrics (field / real users)` from CrUX when data exists; read it there first and note URL or origin scope.
Otherwise, for a public URL, use the PageSpeed Insights web UI (no key needed).
The CrUX API and History API need a Google Cloud key; never make a key a prerequisite for an audit.
Building production telemetry, or reviewing an existing pipeline: read [references/rum.md](references/rum.md).

### 3 Lab trace

Drive Chrome with `chrome-devtools-axi`; take flags from `chrome-devtools-axi <command> --help`.

```bash
chrome-devtools-axi open <url>
chrome-devtools-axi emulate --viewport "390x844x3,mobile,touch" --network "Slow 4G" --cpu 4
chrome-devtools-axi perf-start --no-auto-stop     # reloads the page: cold-load trace
chrome-devtools-axi wait 8000
chrome-devtools-axi perf-stop --file trace.json.gz
```

Tool gotchas, seen in a real run:

- `perf-start` with auto-stop printed no summary; the summary arrives on `perf-stop`, so stop manually.
- `open` followed by "No page is currently selected": run `pages`, then `selectpage <id>`.
- The summary truncates near 10k characters and can cut off the insight list. Query insight names from the phase 4 table directly.

INP needs an interaction, so a load trace has none.
Trace it with `perf-start --no-reload --no-auto-stop`, perform the interaction (`click`, `type`, `press`), then `perf-stop`.

Record the conditions with every lab number: final URL and state, Chrome and tool version, viewport, CPU and network throttling, cold or warm cache, auth, consent, and experiment state.
Before a decision on a headline lab metric, run three equivalent traces and report the median and range.
Set emulation explicitly for each profile you test.

`chrome-devtools-axi lighthouse` covers accessibility, SEO, and best practices only; it is never the performance path.
Its navigation mode reloads the page; use `--mode snapshot` when a reload would lose authenticated or unsaved state.

No browser available: run the project's Lighthouse CLI version and keep the JSON (no permanent install unless the user wants one), or use the PageSpeed Insights web UI for a public URL.

### 4 Insights

Run `chrome-devtools-axi perf-insight <set-id> <name>` with the set id from the summary: `NAVIGATION_0` for a reload trace, `NO_NAVIGATION` for an interaction trace.
Query only insights tied to a failing or suspicious metric, then read the reference for that metric.

| Insight | Metric | Look for | Reference |
|---------|--------|----------|-----------|
| `LCPBreakdown` | LCP | Dominant subpart: TTFB, load delay, load duration, render delay | [lcp.md](references/lcp.md) |
| `LCPDiscovery` | LCP | LCP resource absent from initial HTML, lazy-loaded, or missing `fetchpriority` | [lcp.md](references/lcp.md) |
| `DocumentLatency` | TTFB, LCP | Redirects, slow server response, no text compression | [lcp.md](references/lcp.md) |
| `RenderBlocking` | FCP, LCP | CSS and JS blocking first paint | [lcp.md](references/lcp.md) |
| `NetworkDependencyTree` | LCP | Request chains delaying critical resources; preconnect use | Phase 5 |
| `ImageDelivery` | LCP | Oversized, poorly compressed, or legacy-format images | [lcp.md](references/lcp.md) |
| `FontDisplay` | LCP, CLS | Invisible text while web fonts load | [lcp.md](references/lcp.md) |
| `ModernHTTP` | LCP | Many requests over HTTP/1.1 | [lcp.md](references/lcp.md) |
| `CLSCulprits` | CLS | Shifted node and initiator: unsized media, injected content, font swap | [cls.md](references/cls.md) |
| `INPBreakdown` | INP | Input delay, processing, presentation delay (interaction trace only) | [inp.md](references/inp.md) |
| `ForcedReflow` | INP | Layout read after a style write | [inp.md](references/inp.md) |
| `DOMSize` | INP | Large DOM raising style and layout cost | [inp.md](references/inp.md) |
| `ThirdParties` | All | Third-party bytes and main-thread time by origin | [lcp.md](references/lcp.md), [inp.md](references/inp.md) |
| `Cache` | Repeat visits | Short cache lifetimes on static assets | [codebase.md](references/codebase.md) |
| `LegacyJavaScript`, `DuplicatedJavaScript` | TBT, INP | Polyfills shipped to modern browsers; one module bundled twice | [codebase.md](references/codebase.md) |
| `Viewport` | INP | Missing mobile viewport meta | — |

An unknown name returns "No Insight with the name ... found"; the trace summary then lists what exists.

### 5 Network

List requests with `chrome-devtools-axi network --type <type>` (`document`, `script`, `stylesheet`, `font`, `image`).
Fetch `network-get <id>` only for a request that backs a finding.

1. **Render-blocking**: JS or CSS in `<head>` without `async`, `defer`, `type="module"`, or a non-matching `media`.
2. **Chains**: resources discovered late behind other resources (CSS `@import`, JS-injected fonts or images).
3. **Missing priority**: the LCP image, critical fonts, or key scripts discovered late with no preload or `fetchpriority`.
4. **Caching**: missing or weak `Cache-Control`, `ETag`, `Last-Modified`.
5. **Payloads**: uncompressed or oversized JS, CSS, images.
6. **Preconnects**: per the Judgment rule, zero requests to the origin means remove it.

### 6 Codebase

With source access, read [references/codebase.md](references/codebase.md): stack detection, bundle and tree-shaking checks, polyfills, compression, caching headers, budgets.
Without a running page, every finding here is a **hypothesis** paired with the trace or insight that would confirm it.

### 7 Fix and verify

Apply fixes only to measured bottlenecks, then re-run phase 3 under identical conditions and report before and after.
Field improvement stays **pending**: CrUX is a rolling 28-day window and RUM needs new visits, so never claim a field gain right after a deploy.

## Output

Lead with the evidence table:

| Signal | Scope and conditions | Baseline | After | Source |
|--------|----------------------|----------|-------|--------|
| LCP | URL, phone, p75, 28 days | 3.1 s | Pending field window | CrUX |
| LCP | URL, mobile lab, Slow 4G, CPU 4x, cold, median of 3 | 3.8 s | 2.6 s | DevTools trace |

Then, in order:

1. **Measured failures**: each metric with value, rating, and evidence type.
2. **Trace-backed causes**: ranked by estimated savings, each naming the insight or request that proves it.
3. **Hypotheses**: source-only findings, each with the measurement that would confirm it.
4. **Recommendations**: specific changes with the code or config snippet.
5. **Codebase findings**: detected stack and bundle opportunities; omit without source access.
6. **Verification status**: what was re-measured, what stays pending, remaining uncertainty.

An excellent page gets the evidence table and one line saying so.
