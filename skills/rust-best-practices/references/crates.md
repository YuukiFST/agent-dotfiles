# Crates, modules, dependencies

Part of the `rust-best-practices` skill, read when its SKILL.md points here.

- **Prefer small, single-purpose crates** in a flat `crates/` workspace; never nest a
  crate inside another crate's `src/`. Split when a crate grows a second purpose or a
  subdirectory. Share versions and lints through `[workspace.dependencies]` and
  `[workspace.lints]`.
- **Modules:** name a leaf module after its primary item (`Foo` lives in `foo.rs`).
  Non-leaf modules contain only `mod` declarations and re-exports. Put the essential items
  at the crate root and group the rest by use case (`account`, `network`), not by kind
  (`traits`, `errors`). Don't define a prelude.
- **Re-export individually** (`pub use foo::{A, B};`), never with a glob.
- **Dependencies:** every one costs compile time, binary size, and supply-chain exposure,
  including `build.rs` and proc macros. Use ranges (`"1"`, `"1.4"`), never `"*"` or a
  needless `"="`. Commit `Cargo.lock` for binaries. Audit with `cargo tree --duplicates`,
  `cargo deny`, `cargo udeps`, and `cargo audit`.
- **Features are additive and bare-named:** `std`, `serde`, `alloc`, `test-util`. Never
  `no-std`, `use-serde`, or a feature that removes or changes a public item. Don't
  feature-gate struct fields or trait methods. Put mocks and fakes behind `test-util`.
- **Semver:** breaking changes include removing or renaming public items, adding a
  variant to an enum that isn't `#[non_exhaustive]`, adding a field to a publicly
  constructible struct, adding a trait bound, or making a trait non-object-safe.
  Deprecate in a minor release before removing in a major one. Use the latest stable
  edition for new crates and set an MSRV deliberately.
- Don't run code before `main()` (no `ctor`-style crates). Don't use unstable features
  on a stable toolchain.
