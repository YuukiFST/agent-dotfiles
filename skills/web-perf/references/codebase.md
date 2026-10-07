# Codebase analysis

Read in phase 6, with source access.
Without a running page every finding here is a **hypothesis**; name the insight or request that would confirm it.

## Detect the stack

Check `package.json` dependencies and build scripts, then the config files:

| Tool | Config files |
|------|--------------|
| Webpack | `webpack.config.js`, `webpack.*.js` |
| Vite | `vite.config.js`, `vite.config.ts` |
| Rollup | `rollup.config.js`, `rollup.config.mjs` |
| esbuild | `esbuild.config.js`, build scripts calling `esbuild` |
| Parcel | `.parcelrc`, `parcel` field in `package.json` |
| Next.js | `next.config.js`, `next.config.mjs`, `next.config.ts` |
| Nuxt | `nuxt.config.js`, `nuxt.config.ts` |
| SvelteKit | `svelte.config.js` |
| Astro | `astro.config.mjs` |

Retrieve the detected framework's current image, font, script, and rendering APIs through context7 before recommending one.

## Bundle size and dead code

- **Tree-shaking**: Webpack needs `mode: 'production'` and accurate `sideEffects` in `package.json`; Vite and Rollup shake by default, check `treeshake` overrides.
- **Wholesale imports**: whole-library imports (`import _ from 'lodash'`, `moment`) and barrel files (`index.js` re-exports) that defeat shaking. Import the function path or swap for a smaller library.
- **Code splitting**: route-level and heavy-component `import()`; eager imports of code only some users reach.
- **Unused CSS**: CSS-in-JS runtime versus static extraction; Tailwind `content` globs or PurgeCSS configured.
- **Duplicates**: the same package at two versions (`DuplicatedJavaScript`); check the lockfile.

## Polyfills and targets

- `@babel/preset-env` `targets` and `useBuiltIns`; whole `core-js` imports.
- `browserslist` broader than real traffic ships legacy code to modern browsers (`LegacyJavaScript`).

## Build output and delivery

- Minification with terser, esbuild, or swc.
- Brotli or gzip in the build output or server config.
- Production source maps external or disabled, never inlined.
- Caching headers (`Cache` insight):

```
# HTML
Cache-Control: no-cache
# Hashed static assets
Cache-Control: public, max-age=31536000, immutable
# Unhashed static assets
Cache-Control: public, max-age=86400, stale-while-revalidate=604800
# Personalized API responses
Cache-Control: private, no-cache
```

## Budgets

Keep an existing project budget when one exists.
Otherwise start from these guardrails for a typical content or commerce page and calibrate them to the target devices and networks; they are not pass/fail criteria.

| Resource | Starting budget |
|----------|-----------------|
| Total page weight | < 1.5 MB |
| JavaScript (compressed) | < 300 KB |
| CSS (compressed) | < 100 KB |
| Above-the-fold images | < 500 KB |
| Fonts | < 100 KB |
| Third-party | < 200 KB |
