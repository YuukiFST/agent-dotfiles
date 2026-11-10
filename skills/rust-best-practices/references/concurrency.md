# Concurrency and async

Part of the `rust-best-practices` skill, read when its SKILL.md points here.

- Public types, and the futures they return, should be `Send` (and usually `Sync`). Pin
  it with a compile-time check so a refactor can't silently regress it:

  ```rust
  const _: () = {
      const fn assert_send<T: Send>() {}
      assert_send::<MyClient>();
  };
  ```

  Holding an `Rc` or a `RefCell` borrow across an `.await` makes a future `!Send`.
- Prefer message passing (channels) to shared state. When sharing is necessary: keep data
  with linked invariants under one lock, keep lock scopes to a few lines, never call user
  closures while holding a lock, and never return a `MutexGuard` from a public method.
- Write `async fn` rather than `fn -> impl Future`, except in traits or when setup must
  run outside the async block for a hot path.
- Long CPU-bound work inside async must yield (`tokio::task::yield_now().await` every
  tens of microseconds) or move to `spawn_blocking`.
- Library code doesn't spawn raw threads or assume a runtime; take an executor, a spawn
  function, or `impl AsyncRead` / `impl Read` from the caller.
