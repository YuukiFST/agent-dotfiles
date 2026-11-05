# Supply Chain and Release Hunting

#### When to use this file

Reach for this file when the target resolves dependencies, builds from untrusted contributions, runs CI, creates release artifacts, signs or promotes builds, loads plugins, or updates deployed software. This domain covers trust handoffs from source and dependency to the artifact a user runs. Use `MEMORY-SAFETY-AND-BINARY.md` for flaws inside a local binary loader and `CLOUD-AND-DEPLOYMENT.md` for runtime workload authority.

Split large targets into dependency resolution, CI isolation, artifact provenance, release authorization, and updater/plugin trust.

## Core discipline (include in every agent prompt for this domain)

```
- A mutable or known-vulnerable dependency is not a finding by itself. Show who can influence resolution, which build consumes it, and what execution or release boundary follows. A known advisory climbs the reachability ladder under "Known-vulnerable dependency reachability" before it becomes a candidate.
- Follow integrity across every handoff: source identity, resolved inputs, build worker, artifact identity, test result, signature/attestation, promotion, and update consumer.
- CI configuration is authorization code. Establish which event triggered a workflow, whose code runs, which secrets and tokens exist, and what it may publish or mutate.
- A checksum fetched from the same untrusted location as the artifact does not establish independent integrity. Identify the trusted root and failure behavior.
- Use `confirmed` for in-repo control-flow failures with bounded local validation. Use `needs_validation` for branch protection, hosted-runner, registry, signing-service, or production promotion facts that are not observable.
```

## Dependency and build-input attack classes (subagent_type: `general`)

**Dependency source and namespace confusion**
Resolver configuration can select an unintended public/private namespace, fallback registry, mirror, repository, or source URL. Review package names, source priority, lockfile and checksum use, alternate build files, platform-specific resolution, and first-install versus update behavior.

**Known-vulnerable dependency reachability**
A lockfile pins a version with a published advisory. Take the version from the lockfile and the advisory from a local database, then climb this ladder per advisory, never per package, citing the proof for each rung: `unknown`, `not_imported` (state the search scope), `imported`, `vulnerable_symbol_used` (application code calls a function, class, or option the advisory names), and `reachable_call_path` (a call-graph tool shows the path). `not_imported` never means safe, since dynamic imports and framework wiring evade a search, and a symbol match is never promoted to `reachable_call_path` without the tool. From `vulnerable_symbol_used` on, the candidate needs the ordinary trace from a lower-trust input to that symbol and a bounded local check. Attribute a transitive advisory to the direct dependency that pulls it in, with its resolution chain, and write the fix at that level: a direct-dependency bump whose closure resolves the fixed version, or a resolution override. Without a local advisory database, the lead is `needs_validation` with that blocker.

**Mutable and unbound build inputs**
Builds consume branches, tags, unverified submodules, downloaded tools, generated assets, remote includes, floating CI actions, or container tags whose content can change without source review. A SHA pin can lie too: a commit reachable only from a fork of the action, or a version comment that names a different tag. Checking either needs the network, so it stays `needs_validation`. Require a lower-trust writer and a path into trusted build output; reproducibility by itself does not prove authenticity.

**Generated-source and codegen provenance gaps**
Schemas, vendored archives, generated clients, localization, documentation examples, or binary blobs produce executable or shipped content without the same review and integrity gate as source. Compare local regeneration with committed output and verify who controls input and generator.

**Build-context inclusion**
Secrets, local configuration, repository metadata, test fixtures, or developer artifacts enter a package or image because the build context and ignore rules exceed intended release inputs. Confirm that the resulting artifact exposes a real credential, private data, or privileged configuration.

## CI and automation attack classes (subagent_type: `general`)

**Untrusted code in a privileged workflow**
A pull request, issue comment, fork, dependency update, or external event runs contributor-controlled code with protected secrets, write tokens, deployment authority, or a trusted runner. Compare trigger type, checkout ref, approval gate, environment protection, and permission narrowing. Test that an `if:` gate can be false before counting it: `github.actor` follows the latest actor, so a bot check passes on a contributor's re-run; a multi-line or mixed-text `if:` is a non-empty string that always evaluates true; and `contains()` on a string matches substrings. Do not assume repository-host defaults that are not in source.

**Workflow command and expression confusion**
Attacker-controlled branch names, commit messages, issue fields, artifact names, matrix values, or generated output enter shell commands, template expressions, paths, or privileged workflow inputs without canonical validation. Writing that value to `GITHUB_ENV`, `GITHUB_PATH`, or `GITHUB_OUTPUT` carries it into later steps. Rate each expansion by what the attacker controls: a fixed context such as `github.sha`, `github.repository`, or `github.run_id` is not injectable, a structured one is limited to its shape, and an arbitrary one such as `github.event.pull_request.title` is fully controlled. `secrets.*`, `needs.*.result`, `steps.*.outcome`, and `steps.*.conclusion` are not attacker text, and `env.*` or `matrix.*` count only when their value is dynamic.

**Cache, artifact, and workspace trust mixing**
A lower-trust job can populate a cache, artifact, shared workspace, or output that a higher-trust job later restores and executes or releases. Review cache keys and namespaces, artifact producer identity, digest binding, retention, and whether promotion re-resolves by mutable name. `actions/checkout` persists its token in `.git/config` unless `persist-credentials: false`, so an upload of the checkout directory after it publishes that token.

**Automation identity overreach**
CI jobs receive permissions beyond the operation, repository, environment, or duration needed, and untrusted job inputs can select the affected resource. `toJSON(secrets)`, `secrets: inherit`, and `fromJSON(secrets.X).y` hand a step more than it names, and values unpacked from a JSON secret escape log masking. Missing least privilege alone is hardening; require a reachable privileged action.

**AI review or policy gate that fails open**
A required model-based reviewer or policy check is the only gate on a change, and a path skips it while the job still passes: a cache marker that disables later runs on the same pull request, unpaginated file lists, an empty result reported as success, a retry that drops the diff, or a pull-request marker such as `@generated` that excludes a file. Treat the reviewer as a heuristic, not a control; the finding needs the merge or release it lets through.

## Release and update attack classes (subagent_type: `general`)

**Build-to-promotion substitution**
Tests, review, signature, and publication refer to mutable tags, filenames, channels, or artifact IDs rather than the same immutable digest. Check every copy, repack, architecture merge, and provenance step between build and release.

**Release authorization and signing-policy gaps**
A release or signature is accepted from the wrong workflow, repository, branch, environment, key role, or threshold. Review identity claims inside attestations and verify the consumer validates them, not just a valid signature. Rotation, expiry, and revocation must fail closed where policy requires.

**Update metadata and rollback confusion**
An updater authenticates payload bytes but not version, product, platform, channel, target path, expiry, or rollback state, or it accepts metadata and payload from different authorized transactions. Verify atomic installation and recovery behavior. A signature API call without policy binding is incomplete.

**Plugin and extension trust expansion**
An extension package gains host authority beyond its declared scope, a lower-trust publisher can replace another publisher's identity, or install/update hooks run before authenticity and capability checks. Intended installation of arbitrary same-user plugins is not a privilege boundary.

## Universal moves (apply across the above)

- Walk backward from a released digest or installed update to every source, generated input, credential, worker, cache, test result, and authorization decision.
- Compare untrusted and protected workflow events side by side. Mark each persisted channel crossing between them and require an immutable identity plus producer trust.
- Review revoked key, failed download, missing attestation, partial platform release, rollback, and registry outage paths. The failure policy is part of release integrity.

## Validation rules (apply before reporting ANY finding here)

1. Name the lower-trust actor, controllable source/cache/artifact/metadata, consuming trusted job or updater, and resulting unauthorized publication, code inclusion, secret disclosure, or privileged execution.
2. Prove artifact identity across the broken handoff. A different mutable name or unbound digest must reach a real consumer.
3. Verify built-in package-manager, repository-host, registry, and signing defaults for the pinned version. Unknown hosted controls require `needs_validation`.
4. Keep local validation bounded: use a harmless fixture repository, dummy credential marker, local registry/config, and non-production artifact namespace. Do not publish or alter a real release.
5. Return `confirmed` only with a complete source-visible handoff and meaningful result. Return `needs_validation` with the precise branch, runner, registry, signing, or deployment fact an owner must observe.
