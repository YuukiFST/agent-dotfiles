# Visualize: show data so it reads at a glance

Turn a dataset into the view that answers its reader's question, built in the project's design system. The chart is the last decision, not the first: question, then form, then surface.

No reference owns chart-form selection, so the only form rules here are unslop's defaults, which step 3 offers and never imposes. Everything else is routed: each step names the reference that owns it, read in full before the step.

## 1. Brief the data

Write before any code:

- **Reader and question**: who looks at this, and the one question or decision it serves ("is revenue on track this month?").
- **Shape**: every field with its type (category, number, money, percent, date, duration), unit, range, cardinality, time grain and update rate (static, refetched, streaming), from the schema or the API type, cited `path:line`.
- **States**: every state from the kinds table in `state-machine/SKILL.md` **Find the states in the code**, plus the Empty, One and Huge cases of `break-ui` **Phase 2 — Build the worst case**.
- **Worst case per field**: the rows of `break-ui/CATALOG.md` **Numbers and money**, **Collections** and **Time** that match the field types.

Done when: the question fits one sentence and every field and state has a line.

## 2. Pick the library

Read `package.json` and recon's shared components first: a chart library the project has wins. Only for a gap, read `pick-ui-library/SKILL.md` **Charts** and take its pick, streaming data included.

## 3. Pick the form

The form comes, in this order, from the project's existing view of the same kind of data, from the design source when there is one, or from the user: ask with the question from step 1, offering a table and the forms the step 2 library draws, and take the pick. List first the form the data's shape gets from `REFS/unslop/skills/unslop/SKILL.md` **7. Details**, only from its chart-type rule: a trend is a line, a comparison is bars, a share is one stacked bar or a list with bars, a single goal is a progress bar. A table form sets numbers aligned to the end (`better-layout` `grouping-and-alignment.md`) in tabular figures (`better-typography` **Tabular numbers on changing values**). Several views on one screen run in reading order of importance (`better-layout` **Order by importance**), Where neither the project's existing view nor the design source sets that order, take also the chart-hierarchy rule of the same unslop section: one main chart is the largest view, while every other data block is smaller and of another kind, like a ranked list with thin bars or a short table, never a second chart of the same size.

Done when: each question from step 1 has a form and names where it came from.

## 4. Style it in the project's system

The library's default palette, font and gridlines are replaced by the project's tokens, never kept.

- **Color** (`better-colors`, read `SKILL.md`, `color-usage.md`, `contrast.md`): series colors come from the project's ramps through semantic tokens. Status hues keep their meaning per **One color, one meaning**: red is never just series 3. Every mark reaches 3:1 against the background per the graphical-objects row of `contrast.md`. Meaning carried by color alone is an escalation trigger, so pair it with a label, a position or a shape. Dark mode repoints the same tokens per **Light, dark and increased contrast**. Gridlines use the separator role (`token-naming.md`). One series takes one color, never a rainbow of hues across its bars (`REFS/unslop/skills/unslop/references/signs.md` **Components**, only that rule).
- **Type** (`better-typography`): the project's font on axes, labels and tooltips; **Tabular numbers on changing values** on every figure; **Truncate with a way back** for long category names.
- **Text** (`better-writing`, read `SKILL.md` and `patterns.md`): numbers, units, dates and currency per **Locale formatting**; plurals per **Plurals and placeholders**; the empty state per **Empty states point forward**.
- **Layout** (`better-layout`): the chart aligns to the same edges as the cards around it (**Align to shared edges**), and it reflows at 320px without horizontal scrolling per `better-accessibility` **Survive zoom and text resize**. Where the project sets no chart size, the main chart spans at least two thirds of the content width on desktop and stands 280 to 360 tall, per `REFS/unslop/skills/unslop/references/tokens.md` **App layout**, only its main-chart line.
- **KPI** (`REFS/unslop/skills/unslop/SKILL.md` **7. Details**, only its stat-card rule): a KPI figure is its label and the number, plus its change with what the change compares to (`+12% vs last month`) when the data has a baseline, with no sparkline, tally, mini bar or icon added to fill the card. A project or design that already sets the KPI's layout wins.
- **Line** (craft drafts that contradict none of the three repos; read only the named parts): a line over bounded data takes a monotone curve per `REFS/craft/content/data/curve-smoothing.mdx` **Overshoot on bounded data** and **Choosing** (`d3.line().curve(d3.curveMonotoneX)` in d3), with the data dots visible while the chart is built; a streaming chart keeps its y axis fixed to a known range, per the Usage of `REFS/craft/content/data/living-charts.mdx`.
- **Surface** (`better-ui`): the chart's container uses the project's card surface, radius and shadow, the same as its neighbours. Bars are never pill-shaped, and day labels are never uppercase (`REFS/unslop/skills/unslop/references/signs.md` **Components**, only those two rules).

## 5. Make it readable without sight and without a mouse

Read `better-accessibility/SKILL.md`, `screen-readers.md` (**Alt text**, **SVG**) and `hit-areas.md`. The chart gets a short summary as its accessible name and the full data as a table or text nearby, per the Complex (chart, diagram) row of **Alt text**; an inline SVG carries that name per **SVG**. A tooltip that carries a value is keyboard-reachable (`better-layout` **Hint at hidden content**). A point or bar the user can select has a hit area at the minimum the reference sets, larger than the mark when the mark is thin.

## 6. Decide the motion

Read `find-animation-opportunities/SKILL.md` **The Gate**, especially **4. Function**: data the user reads or acts on does not move for style. A transition between two data states (a filter change) ships only when it clears all four checks, within the durations in `review-animations/STANDARDS.md`, with reduced motion handled. Streaming or frequently refetched data → read `animation-performance/SKILL.md` and keep updates composite-only and off React state per frame (**React: Don't Animate Through State**). A ranked list whose rows reorder on a live update slides each row to its new slot per `REFS/craft/content/data/living-charts.mdx` **Ranked lists**, once it clears The Gate, with reduced motion handled.

## 7. Build every state, then review

Build with a real-shaped fixture and the worst-case fixture from step 1 side by side, every state reachable in the browser. Then run Build's review gate ([build.md](build.md) step 7). The **data viz** trigger is on when the chosen form is a chart or KPI; a table form is reviewed by typography and layout.

Done when: every state renders, both fixtures render without overflow or overlap, and the review gate returns no HIGH finding with changed motion closed on Approve.
