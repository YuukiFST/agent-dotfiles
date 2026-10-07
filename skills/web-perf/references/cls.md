# CLS: Cumulative Layout Shift

Read when field CLS is poor, `CLSCulprits` reports shifts, or source inspection finds content that changes geometry without reserved space.

CLS is the largest session window of unexpected shifts (shifts less than 1 s apart, window at most 5 s), not the sum over the visit; a shift score is impact fraction times distance fraction.
Use the shifted-node and initiator evidence: the element that moved is often the victim of content inserted above it.
Exercise the page states that shift (scroll, late banners, consent, route changes), not only the initial load.

## Reserve media space

```html
<img src="photo.jpg" alt="..." width="800" height="600">
<div class="video-frame"><iframe src="https://video.example/embed/123" title="Demo"></iframe></div>
```

```css
.video-frame { aspect-ratio: 16 / 9; }
.video-frame iframe { width: 100%; height: 100%; }
```

Reserve a realistic minimum for ads and embeds whose final size varies; a placeholder that later collapses also shifts content.

## Place dynamic content in reserved slots

Banners, validation summaries, consent UI, and notifications inserted above visible content shift it.
Use an overlay, insert outside the viewport, or fill a slot that already has its final dimensions:

```javascript
document.querySelector('[data-notification-slot]').replaceChildren(notification);
```

Check that responsive and localized content does not overflow the slot.

## Stabilize fonts

When `CLSCulprits` or `FontDisplay` attributes shifts to a font swap, tune a metric-matched fallback:

```css
@font-face {
  font-family: "Brand Fallback";
  src: local("Arial");
  size-adjust: 102%;
  ascent-override: 92%;
  descent-override: 24%;
  line-gap-override: 0%;
}
```

Derive the values from the actual font pair and test representative text; these numbers do not transfer.

## Animate with transform and opacity

Animating `height`, `width`, `top`, or `left` triggers layout; `transform` and `opacity` do not.
After switching, confirm the moved element does not cover content or change its hit area.

```css
.toast { position: fixed; inset-block-start: 1rem; inset-inline-end: 1rem; transform: translateY(-150%); transition: transform 200ms; }
.toast.is-visible { transform: translateY(0); }
```

## Inspect one session (lab only)

```javascript
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    if (e.hadRecentInput) continue;
    console.log('Layout shift', e.value);
    e.sources?.forEach((s) => console.log(s.node, s.previousRect, s.currentRect));
  }
}).observe({ type: 'layout-shift', buffered: true });
```

## Verify

- [ ] Images and responsive media reserve intrinsic space
- [ ] Ads, embeds, and async components have stable containers
- [ ] Banners and messages do not displace visible content
- [ ] Font swaps use measured fallback metrics where they caused shifts
- [ ] Animations avoid layout properties
- [ ] The shifting page states and viewports re-exercised after the fix
- [ ] Field improvement claimed only after new RUM or CrUX visits

Sources: [Optimize CLS](https://web.dev/articles/optimize-cls), [`size-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust).
