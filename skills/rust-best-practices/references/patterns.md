# Rust patterns

Code examples for the rules in `SKILL.md` whose shape is easier to show than to state.

## Flexible borrows

Borrow the data, not the container holding it, so callers pass whatever they own without copying.

```rust
// Bad: only callers holding a Vec, a String and an Option can call this.
fn summarize(items: &Vec<Item>, title: &String, footer: &Option<Footer>) { ... }

// Good: any slice, any string slice, a borrowed Option.
fn summarize(items: &[Item], title: &str, footer: Option<&Footer>) { ... }
```

## Reporting errors

Pick the mechanism from the API contract.

```rust
// Option: the cause is obvious (overflow); no detail would help.
fn checked_add(a: u32, b: u32) -> Option<u32> { ... }

// Result: the caller needs to know why (NotFound vs PermissionDenied).
fn open_file(path: &Path) -> Result<File, io::Error> { ... }

// panic!: a bug in the caller, a violated precondition.
impl<T> MyVec<T> {
    /// Removes and returns the element at `index`.
    ///
    /// # Panics
    ///
    /// Panics if `index >= self.len()`.
    pub fn remove(&mut self, index: usize) -> T {
        assert!(index < self.len(), "index {index} out of bounds for length {}", self.len());
        // ...
    }
}
```

## Pattern matching over check-then-unwrap

```rust
// Bad: correctness rests on a runtime check the compiler cannot see.
if option.is_some() {
    use_value(option.unwrap());
}

// Good: the pattern proves `value` exists; no panic is possible.
if let Some(value) = option {
    use_value(value);
}

// When a panic is genuinely the right response, say why it cannot happen.
let port: u16 = config.port.expect("validated by Config::load");
```

## Matching a `#[non_exhaustive]` enum

```rust
#[non_exhaustive]
pub enum Shape {
    Circle,
    Square,
    Triangle,
}

// Good: every known variant is listed; the ones that need nothing share the wildcard arm.
fn process_shape(shape: Shape) {
    match shape {
        Shape::Circle => println!("It's a circle"),
        Shape::Square => println!("It's a square"),
        // Triangle and any future variants need no action.
        Shape::Triangle | _ => {}
    }
}

// Good: only one variant matters.
fn process_circle(shape: Shape) {
    if let Shape::Circle = shape {
        println!("It's a circle");
    }
}

// Bad: a new variant, or the existing Triangle and Square, silently fall into `_`.
fn process_shape(shape: Shape) {
    match shape {
        Shape::Circle => println!("It's a circle"),
        _ => {}
    }
}
```

The built-in lint `non_exhaustive_omitted_patterns` enforces this.

## Assertion context

```rust
// Why it should hold.
assert!(
    values.is_sorted(),
    "`values` is populated from a `PriorityQueue`, so we expect it to be sorted"
);

// The offending value.
assert!(refund > 0, "Refund must be positive, got {refund:?}");

// Caller misuse, not an internal bug.
fn execute_query(&self, query: &str) {
    assert!(self.stream.is_some(), "Call connect() before executing queries");
    // ...
}

// Bad: restates the condition.
assert!(values.is_sorted(), "values should always be sorted");
```

## Loops versus combinator chains

A chain that branches or mutates outside state reads better as a loop:

```rust
// Bad
let mut error_count = 0;
let processed_items: Vec<_> = items
    .into_iter()
    .map(transformation_that_may_fail)
    .map(|result| {
        if result.is_err() {
            error_count += 1;
        }
        result
    })
    .filter_map(Result::ok)
    .collect();

// Good
let mut error_count = 0;
let mut processed_items = Vec::with_capacity(items.len());
for item in items {
    match transformation_that_may_fail(item) {
        Ok(val) => processed_items.push(val),
        Err(_) => error_count += 1,
    }
}
```

Bind a chain to a name before looping; the name documents it:

```rust
// Bad
for bug in bug_descriptions
    .iter()
    .filter_map(|description| parse_bug_description(description).ok())
    .filter(|bug| bug.priority <= Priority::P1)
{
    assign_bug(bug);
}

// Good
let urgent_bugs = bug_descriptions
    .iter()
    .filter_map(|description| parse_bug_description(description).ok())
    .filter(|bug| bug.priority <= Priority::P1);

for bug in urgent_bugs {
    assign_bug(bug);
}
```

A short chain whose adapter carries the logic stays a chain:

```rust
// Good
let threshold_exceeded = values.iter().any(|&v| v > threshold);

// Bad: reinvents `any()`.
let mut threshold_exceeded = false;
for &v in &values {
    if v > threshold {
        threshold_exceeded = true;
        break;
    }
}
```

## Accessors

```rust
impl Stuff {
    fn foo(&self) -> &Foo { ... }
    fn foo_mut(&mut self) -> &mut Foo { ... }
    fn set_foo(&mut self, foo: Foo) { ... }

    /// Sets "foo" to `foo` and returns the old value.
    fn replace_foo(&mut self, foo: Foo) -> Foo { ... }

    /// Sets "baz" to `None` and returns the old value.
    fn take_baz(&mut self) -> Option<Baz> { ... }

    /// Calls `f` with a borrow of "bar" and returns what `f` returns.
    fn with_bar<R>(&self, f: impl FnOnce(&Bar) -> R) -> R { ... }

    /// Calls `f` with a mutable borrow of "bar" and returns what `f` returns.
    fn with_mut_bar<R>(&mut self, f: impl FnOnce(&mut Bar) -> R) -> R { ... }
}
```

Closure accessors fit a property behind a `Mutex` or `RefCell`: the closure scopes the access without leaking a `MutexGuard` from the API.
They also fit a property that needs validation after each change but is too costly to clone for a `set_foo()`.

## Imports

```rust
// Good: one module per `use`, types unqualified, functions through their module.
use std::mem;
use foo::Foo;
use foo::bar::{Bar, Baz};

let old = mem::replace(&mut slot, Foo::default());

// Bad: nested paths in braces, a bare imported function.
use foo::{Foo, bar::Bar};
use std::mem::replace;

let old = replace(&mut slot, Foo::default());
```

A trait used in one place is imported there:

```rust
fn parse_port(raw: &str) -> Result<u16, ParseIntError> {
    use std::str::FromStr;

    u16::from_str(raw)
}
```

## Extension traits

```rust
use foreign_crate::ForeignType;

trait ForeignTypeExt {
    fn additional_method(&self);
}

impl ForeignTypeExt for ForeignType {
    fn additional_method(&self) { ... }
}

// Blanket form: in effect a default method added to a foreign trait.
use foreign_crate::ForeignTrait;

trait ForeignTraitExt {
    fn additional_method(&self);
}

impl<T: ForeignTrait> ForeignTraitExt for T {
    fn additional_method(&self) { ... }
}
```

## Documentation

```rust
/// Finds the first `FooItem` with the given `name`, or `None` if not present.
// TODO: crbug.com/12345 - `name` should be &str, not String.
pub fn get_named(items: &[FooItem], name: String) -> Option<&FooItem> { ... }
```

Doc comments a reader gains nothing from:

```rust
/// Removes an element.
pub fn remove_element() -> Element { ... }

/// A mock implementation of the FileSystem trait, intended to be used in unit tests.
impl FileSystem for MockFileSystem { ... }
```

## Unsafe

```rust
/// Returns the element at `index` without a bounds check.
///
/// # Safety
///
/// `index` must be less than `self.len()`.
pub unsafe fn get_unchecked(&self, index: usize) -> &T {
    // SAFETY: the caller guarantees `index < self.len()`, and `self.ptr`
    // points to `self.len()` initialized elements.
    unsafe { &*self.ptr.add(index) }
}
```
