# Code Quality Review

Each reviewer applies this lens in addition to the rubric.
A structural finding names the next change it makes harder or riskier; one that cannot name it is a preference, not a finding.

Not findings: naming, formatting, closure vs. class, a neater type, a few repeated lines, and any "I would have written it differently".
An agent author pays a commit and another review cycle for each comment, so a style comment costs more than it returns.

## Dimensions

Apply the ones that are relevant.

1. **A file pushed past 500 lines.** The global CODING_STANDARDS.md splits a file over 500 lines before appending to it; a diff that crosses the line from below is a finding unless the file stays clearly organized for a structural reason.
2. **Spaghetti growth.** A new ad-hoc conditional, scattered special case or one-off branch in an unrelated flow, where a dedicated helper, state machine or module would hold it.
3. **Removable complexity.** A restructuring that deletes a branch, helper, mode or layer while keeping behavior; moving the same complexity elsewhere does not count.
4. **Magic over boring.** Brittle or ad-hoc behavior, a generic mechanism hiding a simple data-shape assumption, or a pass-through wrapper that adds indirection and no clarity.
5. **Type and boundary.** Optionality, `unknown`, `any` or casts where a typed boundary could exist, or a silent fallback papering over an unclear invariant.
6. **Canonical layer.** Feature logic leaking into shared paths, implementation details leaking through an API, or a reimplementation of an existing helper, named with its `file:line`.
7. **Orchestration.** Related updates that can leave state half-applied, or independent work serialized where the wait costs.

## Precedence

When the repository's own `CLAUDE.md`, `AGENTS.md` or lint config sets a different threshold or convention, the repository wins over this lens.
