# Picking the change

Read before choosing what to change in a hot path.
Every technique here is a hypothesis until the ratchet says otherwise: one change, `measure`, `check`, keep it or revert it.
Apply one only where the profile or trace shows the code hot; in code that is not hot, it adds complexity and moves no number.

## Redesign before you cache

A cache hides a slow design and adds invalidation bugs, memory and a cold path that still runs slow.
Before adding one, make the uncached path fast with the layout changes below.

Every cache already in the code is a removal candidate:

1. Remove it in its own change, and redesign the path it covered when that path is hot.
2. `check`. Keep the removal when no metric regresses; RAM usually drops.
3. When a metric regresses and no redesign wins it back, the cache stays, and the commit body names the metric that needs it.

A cache over I/O the program does not own (network, disk, another process) is a different case: keep it, and measure its hit rate.

## Data layout

Ordered by how often they pay off.
Each line names the metric that should move: if it doesn't, revert.

| Signal in the profile | Change | Moves |
|-----------------------|--------|-------|
| A loop reads one or two fields of many records | Array of structs to struct of arrays: one array per field, so the loop streams only the bytes it uses | instructions, cache misses, frame time |
| Hash lookups dominate, keys are dense or assigned by the program | Flat array indexed by an integer id; ids replace pointers between records | instructions, heap blocks |
| Records point at each other through heap pointers | Store records in one array and link them by index; free a record by putting its slot on a free list | heap blocks, RAM, cache misses |
| One field of the target is read on almost every hop | Pack it into spare upper bits of the index, so the hop skips a load; only after the index change above has landed and been measured | instructions |
| Many short lists, typical length small and known | Inline-capacity list stored on the stack or in its owner, spilling to the heap only past the capacity | heap blocks, heap bytes |
| Arrays of flags | Bitset, 8 flags per byte, tested with word operations. C++ `std::vector<bool>` already packs bits; a Rust `Vec<bool>` stores one byte each | RAM, cache misses |
| Hot structs with padding between fields | Order fields by size, drop fields the hot path never reads into a side table | RAM, cache misses |

In JavaScript, typed arrays (`Float64Array`, `Uint32Array`) give struct of arrays and index links without per-object overhead.

## I/O and database

Data layout moves CPU and memory; these changes move wait time.
Find them in a trace of the real request, not a CPU profile.
Each is a candidate until `check` confirms it: a scan for "hot paths" names where to look, and the trace names what is hot.

| Signal in the trace | Change | Moves |
|---------------------|--------|-------|
| Independent awaits run one after another | Start them together, under a concurrency limit when the count is unbounded | latency |
| One query per item in a list | One batched query | latency, queries per request |
| Whole rows loaded to read a few fields | Select only those columns | latency, bytes read, RAM |
| Hot reads of one key from a large `jsonb` column | Promote the key to a real column; reading one key pulls the whole TOASTed value | latency, buffers read |
| A regex or URL parsed on every call of a hot function | Hoist the regex to module level, and replace the parse with a string check when one answers | instructions |

Check these before you ship each change:

- **Concurrent awaits:** keep the order where one call reads what another wrote, and inside a transaction, which holds one connection.
  `Promise.all` rejects on the first failure while the rest keep running, so a write sequence that used to stop can now half-finish.
  More calls at once also draw more from the connection pool and from rate limits.
- **Promoted column:** a stored generated column keeps the JSON as the single source, but adding one rewrites the table and its indexes.
  On a large table, add a plain column and backfill it in batches.
- **Hoisted regex:** hoist only a regex with no `g` or `y` flag; those keep `lastIndex` between calls.

## Proving it

- Instruction count and heap counts (`count.mjs`) show a layout change cleanly, where wall time drowns it in noise; add them as metrics when the project runs on Linux or in CI.
- A rewrite of a hot path keeps the old version as a differential oracle in the tests, so the speedup ships with the output proven unchanged.
- A change to fonts, images or CSS proves the same thing with a before/after pixel diff built from the same content; classify each visible difference as a content change, a regression to fix, or sub-pixel rounding.
