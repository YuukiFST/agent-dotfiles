# Performance, in order

Part of the `rust-best-practices` skill, read when its SKILL.md points here.

Design for usability first and optimize after measuring. When you do: `Vec::with_capacity`
or `collect()` over push loops; reuse caller-owned buffers in hot APIs
(`fn read_into(&mut self, buf: &mut Vec<u8>)`); `Box<[T]>`, `Box<str>`, `Arc<str>` for
long-lived immutable sequences; `shrink_to_fit` on long-lived collections built without a
reservation; a faster hasher (`foldhash`, `FxHash`) only for trusted keys; batch work
instead of per-item locking; applications may set a `#[global_allocator]` such as
`mimalloc`. Derive `Copy` for small plain types and never for large ones.
