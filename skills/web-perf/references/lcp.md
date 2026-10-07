# LCP: Largest Contentful Paint

Read when field or lab LCP is poor, or `LCPBreakdown`, `LCPDiscovery`, `DocumentLatency`, `RenderBlocking`, `ImageDelivery`, `FontDisplay`, `ModernHTTP`, or `ThirdParties` flags a loading cost.

The LCP element is the largest image, video poster, background image, `<svg>` image, or text block in the viewport.
Fix the subpart `LCPBreakdown` says dominates; never attach generic millisecond savings to a fix.

## Subparts

| Subpart | Dominates when | Typical fix |
|---------|----------------|-------------|
| TTFB | `DocumentLatency` flags redirects or server time | [Server response](#server-response) |
| Load delay | `LCPDiscovery` shows the resource found late | [Discovery and priority](#discovery-and-priority) |
| Load duration | Response bytes or transfer time dominate | [Images](#images), [fonts](#fonts) |
| Render delay | Resource arrived, paint waited; or text LCP with no resource | [Render-blocking](#render-blocking), [client rendering](#client-rendering) |

A text LCP has only TTFB and render delay.

Inspect one session's LCP element (lab only):

```javascript
new PerformanceObserver((list) => {
  const e = list.getEntries().at(-1);
  console.log('LCP', { element: e.element, time: e.startTime, url: e.url, size: e.size });
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

## Server response

- CDN with edge caching for HTML when the page allows it; `Cache-Control: s-maxage=60, stale-while-revalidate=300` style policies for semi-dynamic HTML.
- Remove redirect hops to the final URL.
- Brotli (or gzip) for text assets; HTTP/2 or HTTP/3 (`ModernHTTP`).
- Cold starts on serverless: check whether the trace's TTFB varies by run.
- **Early Hints (HTTP 103)** fit when the trace shows slow HTML generation and stable critical subresources.
  Send an interim `103` with `Link` headers for proven critical preloads or preconnects only; inaccurate hints waste bandwidth.
  Requires HTTP/2 or later; a CDN may synthesize the `103` from `Link` headers on an earlier `200`.
  Cloudflare reported 20-30% LCP improvement in an artificial image-heavy test; treat that as a vendor case study and measure your own result.
  See [MDN 103](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/103).

## Discovery and priority

The LCP resource must be in the initial HTML as a real `<img>` (not a CSS background or JS-injected node), eager, with `fetchpriority="high"`:

```html
<img src="/hero.avif" width="1200" height="600" alt="..." fetchpriority="high">
```

Never `loading="lazy"` on the LCP image.
Add a preload only when the resource stays late after that, for example a CSS background you cannot convert:

```html
<link rel="preload" as="image" href="/hero-800.webp"
      imagesrcset="/hero-400.webp 400w, /hero-800.webp 800w" imagesizes="100vw"
      fetchpriority="high">
```

Preconnect only to origins the LCP path actually requests from (`crossorigin` for fonts and CORS fetches).
For framework image components, retrieve the current priority or preload API through context7; the prop names change between major versions.

## Images

- AVIF or WebP with a fallback; SVG for icons and logos; PNG only for lossless needs.
- Serve the rendered size through `srcset` and `sizes`; `ImageDelivery` reports the wasted bytes.
- `width` and `height` on every image (also prevents CLS).
- `loading="lazy"` and `decoding="async"` for below-the-fold images only.

```html
<picture>
  <source type="image/avif" srcset="hero-800.avif 800w, hero-1200.avif 1200w" sizes="(max-width: 600px) 100vw, 50vw">
  <source type="image/webp" srcset="hero-800.webp 800w, hero-1200.webp 1200w" sizes="(max-width: 600px) 100vw, 50vw">
  <img src="hero-1200.jpg" width="1200" height="600" alt="..." fetchpriority="high">
</picture>
```

## Fonts

- WOFF2, subset with `unicode-range`, one variable font instead of many weight files when several weights ship.
- `font-display: swap` for text that must show immediately; `optional` for non-critical fonts (`FontDisplay`).
- Preload only the font that renders the LCP text: `<link rel="preload" href="/f.woff2" as="font" type="font/woff2" crossorigin>`.
- Font swaps that shift layout: see [cls.md](cls.md#stabilize-fonts).

## Render-blocking

- Scripts: `defer` for app code, `async` for independent scripts, `type="module"` is deferred by default. Parser-blocking `<script src>` in `<head>` is the anti-pattern.
- CSS: remove unused rules first; split per-route; load print or wide-screen sheets with a non-matching `media`.
- Inline critical CSS only when `RenderBlocking` proves the stylesheet delays first paint, and keep the inlined block small:

```html
<style>/* proven above-the-fold rules */</style>
<link rel="preload" href="/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/styles.css"></noscript>
```

## Client rendering

When the LCP element is absent from the initial HTML and render delay dominates, move the content into server output: SSR, static generation, or streaming SSR.
Retrieve the current framework API through context7 rather than writing it from memory.

## Third parties

Attribute bytes and main-thread time with `ThirdParties`.
Load analytics and widgets `async`, or inject them on visibility or interaction; use a facade (static thumbnail, real embed on click) for video and chat widgets.

## Next navigation: Speculation Rules

Prerendering a likely next page speeds that navigation, not the current page's LCP.
Use it after the current page is fixed, for predictable same-origin journeys.

```html
<script type="speculationrules">
{ "prerender": [{
  "where": { "and": [
    { "href_matches": "/*" },
    { "not": { "href_matches": "/logout" } },
    { "not": { "href_matches": "/cart/*" } }
  ] },
  "eagerness": "moderate"
}] }
</script>
```

| `eagerness` | Trigger (Chrome, recheck before relying on timing) |
|-------------|---------|
| `conservative` | Pointer or touch down |
| `moderate` | Desktop: 200 ms hover or earlier pointer down; mobile: viewport heuristics |
| `eager` | Chrome 143+: desktop 10 ms hover; mobile 50 ms after the anchor enters the viewport |
| `immediate` | As soon as the rules are observed |

- Each prerender costs roughly a full page load: scope `where`, exclude logout and checkout, start conservative, and measure hit rate, bytes, and server load.
- Analytics and other load side effects fire at prerender time; gate them on `document.prerendering` and the `prerenderingchange` event.
- Chromium only; other browsers ignore the script.
- Timing source: [Chrome prerender docs](https://developer.chrome.com/docs/web-platform/prerender-pages#eagerness).
