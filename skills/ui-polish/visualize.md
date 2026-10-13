# Visualize: show data so it reads at a glance

Turn a dataset into the view that answers its reader's question, built in the project's design system. The chart is the last decision, not the first: question, then form, then surface.

Neither reference repo owns chart selection, so the form table in step 2 is this skill's own rule set. Everything else is routed: each step names the reference that owns it, read in full before the step.

## 1. Brief the data

Write before any code:

- **Reader and question**: who looks at this, and the one question or decision it serves ("is revenue on track this month?"). Two unrelated questions are two views.
- **Shape**: every field with its type (category, number, money, percent, date, duration), unit, range, cardinality, time grain and update rate (static, refetched, streaming), from the schema or the API type, cited `path:line`.
- **States**: every state from the kinds table in `state-machine/SKILL.md` **Find the states in the code**, plus the chart-specific ones: a single point and the largest real set.
- **Worst case per field**: from `break-ui/CATALOG.md` **Numbers and money**, **Collections** and **Time**: zero, negative, a value 1,000× the median, a 40-character category name, 500 categories, a gap in the series.

Done when: the question fits one sentence and every field and state has a line.

## 2. Pick the form

Take the first row whose question matches. The simplest form that answers it wins; a chart that needs a legend to decode one number is the wrong form.

| The question | Form |
| --- | --- |
| One figure that matters now | A KPI: the number large, its delta and the comparison period beside it; a sparkline only when the trend changes the reading |
| Exact values the reader looks up or copies | A table, numbers right-aligned in tabular figures |
| Compare categories | Bars, sorted by value unless the categories carry their own order; horizontal when labels run long |
| Change over time | A line; bars only for a few discrete periods |
| Part of a whole | One stacked bar, or a 100% bar per group; a donut only for two or three parts |
| Distribution of one measure | A histogram or a box plot |
| Relationship between two measures | A scatter plot |
| Values arriving live | A streaming line, per `pick-ui-library` **Charts** |

House rules for every form: bars start at zero; one y-axis per chart; flat 2D marks; label series directly at the line end or bar when there are five or fewer, with a legend only past that; more than six categories → the top five plus "Other". Several questions → a small grid of views sharing one time range and one scale, in reading order of importance (`better-layout` **Order by importance**).

Done when: each question from step 1 has a form and one sentence on why it beats the table.

## 3. Pick the library

Read `package.json` and recon's shared components first: a chart library the project has wins. Only for a gap, read `pick-ui-library/SKILL.md` **Charts** and take its pick. Hand-rolled SVG is right for a sparkline or a single bar, not for axes and tooltips.

## 4. Style it in the project's system

The library's default palette, font and gridlines are replaced, never kept.

- **Color** (`better-colors`, read `SKILL.md`, `color-usage.md`, `contrast.md`): series colors come from the project's ramps through semantic tokens. A magnitude uses steps of one hue; a value around a meaningful midpoint (zero, target) uses two hues diverging from a neutral; categories use distinct hues. Status hues keep their meaning per **One color, one meaning**: red is never just series 3. Every mark reaches 3:1 against the background per the graphical-objects row of `contrast.md`. Meaning carried by color alone is an escalation trigger, so pair it with a label, a position or a shape. Dark mode repoints the same tokens per **Light, dark and increased contrast**.
- **Type** (`better-typography`): the project's font on axes, labels and tooltips; **Tabular numbers on changing values** on every figure; **Truncate with a way back** for long category names.
- **Text** (`better-writing`, read `SKILL.md` and `patterns.md`): the title states the takeaway or the question in plain words; units on the axis or in the label, never left to guess; numbers, dates and currency per **Locale formatting**; plurals per **Plurals and placeholders**; the empty state per **Empty states point forward**.
- **Layout** (`better-layout`): the chart aligns to the same edges as the cards around it (**Align to shared edges**); gridlines are few and use the separator token; the plot keeps its aspect at 320px or collapses to the table.
- **Surface** (`better-ui`): the chart's container uses the project's card surface, radius and shadow, the same as its neighbours.

## 5. Make it readable without sight and without a mouse

Read `better-accessibility/SKILL.md`, `screen-readers.md` (**Alt text**, **SVG**) and `hit-areas.md`. The chart gets a short summary as its accessible name and the full data as a table or text nearby. Tooltips open on keyboard focus as well as hover. A point or bar the user can select has a hit area at the minimum the reference sets, larger than the mark when the mark is thin.

## 6. Decide the motion

Read `find-animation-opportunities/SKILL.md` **The Gate**, especially **4. Function**. On a product screen it rules out a draw-in on load. A transition between two data states (a filter change) passes only when it shows what changed, within the durations in `review-animations/STANDARDS.md`, with reduced motion handled. Streaming or frequently refetched data → read `animation-performance/SKILL.md` and keep updates composite-only and off React state per frame.

## 7. Build every state, then review

Build with a real-shaped fixture and the worst-case fixture from step 1 side by side, every state reachable in the browser. Then run Build's review gate ([build.md](build.md) step 7) with the **data viz** trigger on, so the data-viz reviewer joins the default set.

Done when: every state renders, both fixtures render without overflow or overlap, and the review gate returns no HIGH finding.
