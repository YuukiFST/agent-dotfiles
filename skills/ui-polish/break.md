# Break: stress-test one component

Render one real component under every scenario that can reach it in production, look once, report what broke, stop. A component built against kind demo data looks finished until real content arrives.

Two references, one procedure. jakubkrehel `break` owns the harness: which axes to run, one scratch page, one look. emilkowalski `break-ui` owns the values: the worst case each scenario renders, and the failure signatures that name cause and fix. Read before step 1:

- `REFS/jakubkrehel-skills/skills/break/SKILL.md` and `scenarios.md`
- `REFS/emilkowalski-skills/skills/break-ui/SKILL.md` (**Operating Posture**, **Hard Rules**, **Failure signatures**, **Truncate, wrap, or clamp**) and `CATALOG.md`

`break-ui`'s toggle (Phase 3) and its standalone HTML file are replaced by `break`'s harness page. Everything else in both files applies.

## 1. Scope one component

Per `break` **Scope one component**: one component per run, restated in one sentence. A screen or a page is several components; list them and ask which.

## 2. Map the rendered values

Per `break-ui` **Phase 1 — Map the surface**: one row per value the component renders, with source, type, limit and optional flag. Limits come from the validation schema, the database column, the API type or the form `maxLength`, cited `path:line`. No limit anywhere → `unbounded`, itself a `Fragile` finding. A frontend limit shorter than the backend column is a finding too.

Done when: every rendered value, counts and the list length included, has a row with a source and a limit or `unbounded`.

## 3. Pick the axes, then the values

Walk `scenarios.md` against the component and keep only the axes whose cue matches; name the dropped axes and why, in one line. For every kept axis, fill each scenario with values from `CATALOG.md` for the matching field type, or with the schema limit from step 2. Spread failures across rows of a list instead of stacking them into row 1.

Every value is plausible or schema-backed, the `break-ui` **Hard Rules**. `"aaaa…"` and 5,000-character strings prove nothing.

Done when: the scenario plan is written, one line per scenario with its concrete value.

## 4. Build the harness page

Per `break` **Build the harness page**: one scratch route inside the app, the real component imported, one labelled instance per scenario, widths as fixed containers on the page. Fixtures enter at the data boundary (props, fixture, mock), never by editing the component's markup or CSS. In Next.js the page is client code.

## 5. Look once

Per `break` **Look once**: one load with `chrome-devtools-axi`, every scenario skimmed, each visible break noted under its label in a single edit. No browser at hand → hand over the URL and skip the look; a predicted break is not a finding.

Diagnose each break against `break-ui` **Failure signatures**: the signature names the cause and the fix. A long string gets a per-field decision from **Truncate, wrap, or clamp**.

## 6. Report and stop

| # | Severity | Scenario | Value | Observed | Fix | Owner |
| --- | --- | --- | --- | --- | --- | --- |

- Severity is `break-ui`'s: **Broken** (unreadable, unreachable, wrong data), **Ugly** (readable but visibly wrong), **Fragile** (fine now, one realistic step from breaking; evidence is the `path:line` of the missing limit or fallback).
- Fix is the signature's fix in the project's tokens and idiom, with the `path:line` it lands on.
- Owner is the domain reference whose rules diagnose it (`better-layout`, `better-typography`, `better-writing`, `better-accessibility`, `better-colors`, `better-ui`).

Then, per `break-ui` **Required Output Format**: **Decisions for you** (breaks with more than one right answer, one line each with a recommendation) and **What held up**. Close with the harness URL, the scenarios on it, the environment modes for the user to toggle (dark, zoom 200%, RTL, reduced motion), and `fix all` / `fix 1, 3`.

## 7. Fix on request

Apply the named fixes in the project's idiom. Re-render every scenario, typical content included, so a worst-case fix does not regress the baseline. Then run the project gates from recon step 6.

The page stays up until the user says they are done. On deletion, offer to keep the worst-case fixture next to the demo fixture as the component's regression data.
