---
name: rust-best-practices
description: Rust best practices from Google's Rust style guide. Use when reading, editing or reviewing any .rs file.
paths: ["**/*.rs"]
---
<!-- Source: https://github.com/google/styleguide/blob/gh-pages/rustguide.md pinned at 2ac1584 (CC BY 3.0, notice in LICENSE). Condensed and adapted: Chromium-, Fuchsia- and Android-only rules dropped, examples moved to references/patterns.md with their syntax errors fixed. -->

# Rust best practices

Apply the **principle-type-system-discipline** skill first; errors also follow **principle-error-design**.

The repository's own `rustfmt.toml`, `clippy.toml`, `[lints]` and established conventions win over this file.
Below them come `rustfmt`, the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/), then these rules.

Classify the crate before applying a rule marked *lib*:

- **Library** (used by other projects, solves a general problem): *lib* rules bind.
- **Application** (one program, a specific problem): *lib* rules are strong defaults; pick the simple, direct form and generalize only for a present need.

## Ownership, inputs and outputs

| Rule | Summary |
|------|---------|
| Unique ownership | Own or borrow. `Rc`/`Arc` only when the borrow structure would be unreasonably complex to write or maintain. |
| Borrow before clone | `.clone()` for a real deep copy, or when the borrow graph turns excessively complex. Cloning an `Rc`/`Arc` handle is fine. |
| Flexible borrows | `&T` over `&Box<T>`, `&[T]` over `&Vec<T>`, `&str` over `&String`, `Option<&T>` over `&Option<T>`. Clippy: `borrowed_box`, `ptr_arg`. |
| Iterator returns (*lib*) | Return `impl Iterator` or a concrete iterator over `Vec<T>`. Return `Vec` when most callers need one, the body builds one anyway, callers index it, or making a new collection is the function's purpose. |
| Iterator params (*lib*) | Accept `impl IntoIterator` when the function only iterates. Application code takes `&[T]`. |
| `impl Into<T>` (*lib*) | Only where call-site ergonomics are paramount, weighed against code bloat. Application code almost never. |
| `enum` over `bool` | A parameter whose meaning is unclear at the call site is an `enum`. A remaining `bool` argument gets an inline `/* name */` comment. |

## Errors and panics

| Rule | Summary |
|------|---------|
| `Option` | Simple failure with an obvious cause and nothing more to tell the caller (`checked_add`). |
| `Result` | Recoverable failure the caller must tell apart, usually external (I/O, network). |
| `panic!` | Bugs and violated preconditions only; developer tools and tests may panic more freely. Document every panic in the doc comment. |
| Error types | Make them `Copy` unless they must hold non-`Copy` data such as a `String`. |
| Match, not check-then-unwrap | `if let Some(v) = x` over `if x.is_some() { x.unwrap() }`: the pattern proves it to the compiler. |
| `expect` over `unwrap` | When an invariant cannot live in the type system, `expect("why it holds")`. |
| Assertion context | `assert!(cond, "...")` says why it should hold, shows the offending value, or names caller misuse versus an internal bug. A message that restates the condition adds nothing. |
| No `catch_unwind` | Only as a defense-in-depth wrapper at entry points under `panic=unwind`, never relied on for any property. |
| Poisoned mutex | Treat a poisoned lock as fatal; never recover its contents through `PoisonError::into_inner`. |

## Types and traits

| Rule | Summary |
|------|---------|
| Newtype over alias | A newtype when semantics differ, it needs its own API, the representation may change, or values mix up easily (`Day`, `Month`, `Year`). |
| Named fields | Named-field structs over tuples and multi-field tuple structs. Tuples only for newtypes or a very local scope. |
| Std traits over look-alike methods | `impl FromStr`, not an inherent `fn from_str`. Keeping both for discoverability is fine. Clippy: `should_implement_trait`. |
| `#[derive]` | Derive every impl a derive can express. |
| Proactive impls (*lib*) | Libraries anticipate standard trait impls; applications add one when a caller needs it. |
| Trait checklist | `Clone` unless it owns an external resource. `Copy` when it will stay `Copy`. `Default` when it has `new()` or a natural default (clippy `new_without_default`). `PartialEq`/`PartialOrd` for `==`/`<`; `Eq`/`Ord` only when reflexive and totally ordered. Likely map key: `Hash` + `Eq`, plus `Ord` if totally ordered. Public fields: the traits every field implements. |
| Options structs | An all-public-field bag of options implements `Default`, so callers write `Opts { a: 1, ..Default::default() }`. |
| `From` plus constructor | A primary `From` impl comes with an inherent `new()` or `from_foo()`. |
| Generics over `dyn` (*lib*) | `T: Trait` or `impl Trait` parameters over `dyn Trait`, unless code size matters. |
| Traits earn their place | Define a trait for a generic bound, an `impl Trait`/`dyn Trait` boundary, or an extension trait. Everything else is an inherent `impl`. |
| Extension traits | Suffix `Ext` (`ForeignTypeExt`); the team owning the extended type owns the trait. |
| Operators | Overload an operator only for its mathematical or logical meaning. |
| API sets | `len()` comes with `is_empty()`. Clippy: `len_without_is_empty`. |

## Public API stability (*lib*)

| Rule | Summary |
|------|---------|
| `#[non_exhaustive]` | On public enums, and public structs with public fields, used across teams. Skip it when the shape cannot change (`Color`, `Rectangle`, a two-state enum), when you will fix every caller yourself, or (structs) when callers need `..Default::default()`. |
| `#[must_use]` | On functions whose result is useless or dangerous to ignore (pure functions, error or status returns whose type lacks it), and on types returned that way (error types, lazy computations). |
| `const fn` | Mark a public fn `const` only if it will stay `const`; dropping `const` breaks callers. |
| `#[doc(hidden)]` | Another crate's hidden items are private. |

## Naming

| Rule | Summary |
|------|---------|
| Conversions | `as_` cheap borrow to borrow, `to_` costly or owned, `into_` consumes `self`. Clippy: `wrong_self_convention`. |
| Constructors | `new()`, `new_with_foo()` for alternatives, `try_new()` when it returns `Result`, `from_foo()` paired with a `From` impl. |
| Accessors | `foo()` get, `foo_mut()` `&mut` get, `set_foo()` set, `take_foo()` clear and return old, `replace_foo()` set and return old, `with_foo(\|f\| ..)` / `with_mut_foo` scoped closure access for interior mutability or post-change validation. |
| Lifetimes | Descriptive names (`'src`), above all on types. `'_` where it works; up to two single letters to relate a method's inputs and outputs or in `for<'a>`. |
| Generic parameters | Short, hinting at the main bound (`I: Iterator`); `T`/`U` for unbounded containers. |
| Abbreviations | Spell words out. Keep only abbreviations an outsider knows (`IpAddr`, common on Wikipedia). |

## Modules and imports

| Rule | Summary |
|------|---------|
| Leaf module names | A leaf module centred on `Foo` is `mod foo` in `foo.rs`. |
| Thin non-leaf modules | Non-leaf modules hold `mod` declarations and re-exports, plus at most a little glue. |
| Explicit imports | Name each import. Globs only for `use super::*` in inline modules, `use MyEnum::*` inside functions about that enum, and `pub use sub::*` in non-leaf modules. Define no preludes. |
| One module per `use` | Braces stay flat: `use foo::bar::{Bar, Baz};`, never `use foo::{Foo, bar::Bar};` (`imports_granularity = "Module"`). |
| Local trait imports | `use` a trait inside the function that needs it, unless the whole file calls its methods. |
| Qualified functions | `use std::mem;` then `mem::swap(..)`. Bare function imports only for names already unambiguous or when module names collide. |
| Unqualified types | `use regex::Regex;` then `Regex`. Qualify (`io::Error`) or rename (`as IoError`) on a clash, a large type family, macros or generated code. |

## Docs, formatting and the rest

| Rule | Summary |
|------|---------|
| rustfmt | Format with the repo's formatter. `#[rustfmt::skip]` only for deliberate alignment (matrices, tables) or generated code. |
| Doc comments | `///` on every public item, `//!` at the top of a module or crate, Markdown with capitalization and punctuation. Document panics and `unsafe` invariants. Enough examples somewhere to show how the crate works. |
| Comments add information | A doc comment says what the code does not; omit it rather than restate the name or explain Rust itself. Mix `///` with `//` for implementation notes and TODOs. Write docs directly, not generated by macros. |
| `unsafe` | Only when safe code cannot do it. Wrap it in a safe abstraction away from business logic, ideally its own crate. Each block gets `// SAFETY:` on why it is sound, plus a justification for not being safe (benchmarks when the reason is speed). |
| Stable Rust | Stable features only. |
| Macros last | Functions, types and traits first, then `macro_rules!`, then code generation, then proc macros. |
| Life before `main` | Code starts in `main`; no `ctor`-style initializers. |
| Explicit types | Annotate what a reader cannot infer: results of `.into()`, `.parse()`, `.collect()` and long chains. `let x: T` over turbofish; `::<_>` when the compiler forces one. |
| Loops over long chains | A `for` loop when a chain branches or mutates outside state. Bind a chain to a named variable before looping over it. `for_each` rarely. Short chains whose adapter is the logic (`.any()`) stay. |
| `format!` / `write!` | For joining more than two strings and for substitution into a literal, over `+` and `str::replace`. |

Examples: `references/patterns.md`.
