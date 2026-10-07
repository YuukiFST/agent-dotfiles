# First-party real-user monitoring

Read when the user wants to add, review, or improve production RUM.

## Before changing the site

Telemetry changes production data collection and privacy.
Reuse the existing analytics or RUM pipeline when there is one.
A new endpoint, vendor, cookie, or consent behavior the user did not request is a proposal: get authorization before implementing it.

Use the `web-vitals` library; it follows each metric's lifecycle and the browser edge cases Google's tooling uses, which raw `PerformanceObserver` code does not.
Switch to `web-vitals/attribution` only when someone will review the extra fields and allowlist them deliberately.

## Minimal collection

```javascript
import { onCLS, onINP, onLCP } from 'web-vitals';

function sendToRum({ name, value, rating, id, navigationType }) {
  const body = JSON.stringify({
    name, value, rating, id, navigationType,
    path: location.pathname,
    release: window.APP_RELEASE,
  });
  if (!navigator.sendBeacon?.('/rum', body)) {
    fetch('/rum', { method: 'POST', body, keepalive: true });
  }
}

onCLS(sendToRum);
onINP(sendToRum);
onLCP(sendToRum);
```

Adapt the payload to the existing backend.
Send only explicit, low-cardinality fields: no query strings, user-entered text, DOM fragments, or other personal data.

## Collection rules

- A stable release or experiment identifier, so a regression maps to a change.
- Route templates, not raw URLs, as the grouping key.
- Form factor, navigation type, and coarse connection when the privacy model allows.
- A deliberate, recorded sampling rate; never compare cohorts sampled differently as equal.
- Final metric values only; `reportAllChanges` is for local debugging.
- Consent and regional privacy through the site's existing policy.

## Aggregation and reporting

Per route or journey report p75 of LCP, INP, and CLS; the share of good, needs-improvement, and poor visits; sample count and time window; and key segments (form factor, release, navigation type).
Averages are never the pass/fail signal.

CrUX and RUM disagree when they cover different users, browsers, routes, sampling, or windows; document those differences before calling either source wrong.

Sources: [web-vitals](https://github.com/GoogleChrome/web-vitals), [field measurement best practices](https://web.dev/articles/vitals-field-measurement-best-practices).
