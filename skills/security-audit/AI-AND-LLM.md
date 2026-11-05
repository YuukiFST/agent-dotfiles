# AI, LLM, and Agent Hunting

#### When to use this file

Reach for this file when a language model participates in a trust-sensitive decision: chatbots and assistants, RAG pipelines, persistent agent memory, agent/tool-calling loops, MCP servers and clients, skills, rule files, hooks, and harness settings installed into an agent, code that builds prompts from untrusted input, or code that consumes model output and acts on it. The important data flow is *untrusted content → model or memory → capability, authority, or sink*.

Use this alongside `ATTACK-CLASSES.md`, not instead of it. Transport, access control, query construction, filesystem use, and output rendering remain ordinary trust boundaries. This file covers the model-specific delegation layer. Split large targets by retrieval, memory, tool dispatch, MCP, and output handling.

## Core discipline (include in every agent prompt for this domain)

```
- Prompt injection alone is not a finding. Require a code-level boundary failure: content reaches another principal's context, invokes authority the requester lacks, discloses data they cannot read, or drives a sink they cannot reach directly.
- An instruction file an agent loads with authority (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, a rule or command file) is code: its text is the grant, so no separate sink is needed once a lower-trust writer can reach it.
- Model output, memory, tool descriptions, and MCP responses are untrusted inputs. Point to the code that grants authority, trusts output, writes durable state, or feeds a sink.
- A guardrail prompt is not a security boundary. Count only deterministic checks bound to the final action and resource, resource-scoped authorization, isolation, binding, and constrained credentials. A denylist, pattern scanner, secret redaction, or model judge over attacker-influenced text is a heuristic: it refutes nothing, and bypassing one is not a finding by itself.
- State the attacker, affected principal, effective execution identity, resource, exact action, authority used, and observable impact. An intentional direct request to use the requester's existing authority is not a delegation defect merely because a model executes it.
- Authorization and action binding are separate controls. Attacker-controlled content that causes an action under an affected principal's valid authority is an action-binding failure when that principal did not intentionally request or approve the exact action.
- Classify every candidate as `confirmed` only after source evidence and bounded local validation establish the boundary and result. Use `needs_validation` when a required provider, deployment, model, renderer, or identity behavior is not observable locally.
```

## Context, retrieval, and memory attack classes (subagent_type: `general`)

**Indirect injection through retrieved or ingested content**
An attacker can write a RAG document, indexed page, file, email, issue body, tool response, or metadata that enters a different principal's model context. Trace who can write each source, how retrieval scopes it, whose session consumes it, and what capability is enabled there. Check isolation, resource authorization, and binding to the consuming principal's intent separately. The defect is a missing deterministic control, not persuasive text by itself.

**Cross-session or cross-tenant context bleed**
Conversation history, embeddings, retrieval results, or prompt caches are keyed too broadly. Verify tenant and ACL filters in the query itself and every cache key. A tenant field stored on an object is not enforcement if an alternate query, shared cache, or batch path omits it.

**Persistent memory poisoning**
Attacker-controlled content or model summaries are written into memory that later shapes another task, user, or privileged session. Review who may create, update, merge, and delete memory; its provenance and tenant scope; whether low-trust observations become durable instructions or facts; and whether retrieval distinguishes user preferences from tool policy. Memory intentionally saved by a user and used only for that user's intentional, allowed requests is not a cross-boundary finding.

**Prompt role and provenance confusion**
Prompt assembly lets untrusted text impersonate a system message, prior turn, tool result, policy, or memory record. Look for string concatenation, untyped history, caller-controlled role fields, and serialization round trips that lose source labels. Confirm that the forged provenance changes a deterministic trust decision or reaches a meaningful capability.

## Tool and action attack classes (subagent_type: `general`)

**Tool-argument injection into a downstream sink**
Model-produced arguments reach SQL, shell, file, URL-fetch, or privileged APIs without handler-side validation. Treat the tool schema as input parsing, then follow each field from decoded call to sink. Structured output narrows shape; it does not establish authorization, safe paths, safe URLs, or query semantics.

**Excessive agency and confused-deputy authority**
The agent uses a service identity or broad credential, while the tool handler does not re-check the requesting principal's permission on the named resource. Verify both the effective identity and whether the caller could perform that exact operation through the normal product interface. A shared credential with enforced per-user query scope is not a defect.

**Action-confirmation and approval binding**
A user approves one described action but execution can use changed arguments, a different resource, a different principal, or a later model turn. An action-binding defect also exists when attacker-controlled content causes a side effect under a victim's valid authority without the victim's intentional request or approval, even if generic authorization permits the victim to perform it. Review whether intent or confirmation binds the normalized tool name, complete argument object, requester, target, amount, expiry, and batch membership. Check retries and resumed sessions: an approval must not authorize a mutated or duplicate side effect.

**Tool-schema and dispatcher disagreement**
The schema accepts aliases, extra fields, duplicate keys, coercions, nested free-form objects, or out-of-range values that the dispatcher or handler interprets differently. Compare schema validation, canonicalization, generated bindings, and handler defaults. Validate again where values become resource selectors or security-relevant options.

**Unbounded delegated action loops**
A bounded request can enqueue repeated spend, send, mutation, or external API work without a per-request budget, per-action authorization, cancellation, or idempotency control. Confirm impact on shared cost, quotas, other users, or durable state. Do not test by exhausting a service; use code-level accounting and a locally bounded loop.

## MCP and sub-agent trust classes (subagent_type: `general`)

**Sub-agent and MCP trust inheritance**
A delegated task receives the full session, credentials, memory, or capabilities rather than the least authority required. Check the principal and tenant carried into each call, capability narrowing, credential audience, and whether delegated results are treated as untrusted on return.

**MCP server and tool identity confusion**
Calls or results are routed by attacker-influenceable server names, tool names, request IDs, resource URIs, or model-selected aliases rather than the authenticated connection and outstanding request. Check whether two servers can claim the same tool or resource identity, whether reconnect changes the binding, and whether a response from one server can satisfy another server's pending call.

**MCP metadata and schema as policy**
Tool descriptions, resource metadata, prompts, completion hints, or schemas supplied by an MCP peer are trusted as policy or authorization. These fields can guide the model but cannot grant capability. Find the deterministic allowlist, server identity check, and handler authorization that remain authoritative when metadata conflicts.

## Harness and installed-instruction attack classes (subagent_type: `general`)

Every class here needs a writer of lower trust than the user who runs the agent: a contributor's pull request, a vendored skill, an unpinned plugin, or a repository opened for the first time. A user configuring their own agent crosses no boundary.

**Harness settings that run commands**
A settings file the harness loads from the repository runs a command or redirects the agent. Look for hooks, command-valued keys such as `apiKeyHelper`, `otelHeadersHelper`, `statusLine`, and `fileSuggestion`, and `env` entries that redirect traffic or load code, such as `ANTHROPIC_BASE_URL`, proxy variables, `NODE_OPTIONS`, `LD_PRELOAD`, and `GIT_SSH_COMMAND`. Check when each runs relative to the harness's trust prompt, for the pinned harness version.

**Harness settings that widen authority**
A repository-supplied setting removes a gate: `enableAllProjectMcpServers`, `defaultMode: bypassPermissions`, broad `permissions.allow` entries, or a project MCP server definition that starts a process. Trace who can write the file and whether the harness asks before honoring it.

**Declared behavior differs from actual behavior**
A skill, command, hook, or plugin does more than its name, description, and manifest say: it reads `.claude/`, MCP configuration, credentials, or other skills, sends data out, writes to the agent's own configuration or memory, or widens its scope on update. Compare the declared purpose with every file it bundles and every command it runs.

**Trigger shadowing**
A skill or tool description is written to fire on requests that belong to another skill, or to outrank a security or review step, so a lower-trust publisher captures that work. Compare trigger text against the installed set.

**Unreviewable bundled content**
An instruction or bundled file cannot be read as text by the reviewer: UTF-16 or another encoding the agent still decodes, compiled `.pyc`, an archive, or padding that pushes content past what a viewer shows. Record it as an uncovered unit, never as clean.

## Output and disclosure attack classes (subagent_type: `general`)

**Insecure output rendering**
Model output reaches an executing HTML, Markdown, template, URL, or command sink, or a terminal or log viewer that honors ANSI, OSC 8, or OSC 52 escape sequences, without the sink's required encoding and policy. For browser rendering, verify auto-loaded resources and CSP or sanitization in `CLIENT-SIDE.md`; renderer behavior outside the repository makes the candidate `needs_validation`.

**Sensitive context extraction**
The assembled context contains credentials, another user's data, private source, or policy values that themselves grant access, and user-influenced output exposes them. Read prompt assembly and data-fetch code. Disclosure of generic instructions or behavior that does not cross a data boundary is not a finding.

## Universal moves (apply across the above)

- Draw four maps first: each execution identity, each capability, every writable context or memory source, and each output destination. Then connect the principal at the start to the authority at the end.
- Start at side-effecting tools and work backward through dispatcher, schema, confirmation, model context, retrieval, and ingestion. Start at durable memory reads and trace every writer.
- Compare direct, queued, retry, resume, batch, and delegated paths for the same action. The strongest gate must apply after arguments are final and before every side effect.

## Validation rules (apply before reporting ANY finding here)

1. Name the crossed boundary and observable result: attacker, affected principal or shared resource, execution identity, target, and unauthorized or unrequested action or disclosure.
2. For confused-deputy authority claims, prove the tool lacks requester-and-resource authorization and that the attacker cannot perform the same action normally. For action-binding claims, instead prove attacker-controlled content caused an action under the affected principal's authority that the principal did not intentionally request or approve. Valid generic authorization does not establish that intent.
3. For memory or retrieval claims, cite both the attacker-controlled write and the later cross-principal read or privileged decision. A shared record without a reachable consumer is not enough.
4. For action binding, establish the intentional request or normalized approved object, if any, and compare it with the object the handler uses. Confirm a locally observable unrequested action, mutation, duplicate, or authority change without extending the test into harmful execution. For schema disagreement, compare the normalized validated object with the handler's object.
5. For MCP identity claims, verify the authenticated connection, request correlation, tool namespace, and effective credential. Mark `needs_validation` if external server identity or deployment routing is required.
6. Test the deterministic layer with a stub model: replace the provider with a function that returns the exact output or tool call the attacker needs, assert what the handler does with it, and run a benign stub output as the control. This spends no quota and proves the missing control, not the model's persuasion, so set `severity.model_dependent: true` unless the output needs no model cooperation.
7. For a harness or installed-instruction claim, name the lower-trust writer, the file they can reach, and what the harness does with it at the pinned version. Read these files as text; the audit never loads them.
8. Return `confirmed` findings only with a complete source trace and meaningful result. Return `needs_validation` for a specific unresolved boundary fact and state the bounded local or owner-observed check needed to resolve it.
