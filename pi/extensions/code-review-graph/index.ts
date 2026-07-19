/**
 * code-review-graph tools for pi.
 * Wraps the CRG CLI so pi can use graph-backed review without native MCP.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";

const TIMEOUT_MS = 120_000;
const REPO_OPTIONAL = Type.Optional(
	Type.String({ description: "Repository root (defaults to session cwd)" }),
);

function resolveCrgBin(): string {
	return process.env.CRG_BIN ?? join(homedir(), ".local/bin/code-review-graph");
}

async function runCrg(
	pi: ExtensionAPI,
	args: string[],
	repo: string | undefined,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<{ content: Array<{ type: "text"; text: string }>; details: Record<string, unknown> }> {
	const root = repo ?? cwd;
	const result = await pi.exec(resolveCrgBin(), [...args, "--repo", root], {
		timeout: TIMEOUT_MS,
		signal,
		cwd: root,
	});
	const text = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
	if (result.code !== 0) {
		return {
			content: [
				{
					type: "text",
					text: `code-review-graph failed (exit ${result.code}):\n${text || "(no output)"}`,
				},
			],
			details: { exitCode: result.code, repo: root },
		};
	}
	return {
		content: [{ type: "text", text: text || "(no output)" }],
		details: { exitCode: 0, repo: root },
	};
}

export default function codeReviewGraphExtension(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const check = await pi.exec(resolveCrgBin(), ["--version"], { timeout: 10_000 });
		if (check.code !== 0) {
			ctx.ui.notify(
				"code-review-graph not found — run: bash ~/Projects/my-harness-config/scripts/setup-pi.sh",
				"warning",
			);
		}
	});

	const graphGuidelines = [
		"Prefer these tools over Grep/Glob/Read when a .code-review-graph/graph.db exists in the repo.",
		"Build the graph first with: code-review-graph build (or update for incremental).",
	];

	pi.registerTool({
		name: "crg_detect_changes",
		label: "CRG detect changes",
		description:
			"Analyze git changes against the code-review-graph (blast radius, risk). Read-only on the existing graph.",
		promptGuidelines: graphGuidelines,
		parameters: Type.Object({
			base: Type.Optional(Type.String({ description: "Git diff base (default: HEAD~1)" })),
			brief: Type.Optional(Type.Boolean({ description: "Compact risk summary instead of full JSON" })),
			repo: REPO_OPTIONAL,
		}),
		async execute(_id, params, signal, _onUpdate, ctx) {
			const args = ["detect-changes"];
			if (params.base) args.push("--base", params.base);
			if (params.brief) args.push("--brief");
			return runCrg(pi, args, params.repo, ctx.cwd, signal);
		},
	});

	pi.registerTool({
		name: "crg_impact_radius",
		label: "CRG impact radius",
		description: "Blast-radius analysis for changed files using the code-review-graph.",
		promptGuidelines: graphGuidelines,
		parameters: Type.Object({
			files: Type.Optional(
				Type.Array(Type.String(), { description: "Changed files (auto-detected when omitted)" }),
			),
			depth: Type.Optional(Type.Number({ description: "Traversal depth" })),
			max_results: Type.Optional(Type.Number({ description: "Max nodes in result" })),
			base: Type.Optional(Type.String({ description: "Git diff base" })),
			repo: REPO_OPTIONAL,
		}),
		async execute(_id, params, signal, _onUpdate, ctx) {
			const args = ["impact"];
			if (params.files?.length) args.push("--files", ...params.files);
			if (params.depth !== undefined) args.push("--depth", String(params.depth));
			if (params.max_results !== undefined) args.push("--max-results", String(params.max_results));
			if (params.base) args.push("--base", params.base);
			return runCrg(pi, args, params.repo, ctx.cwd, signal);
		},
	});

	pi.registerTool({
		name: "crg_query_graph",
		label: "CRG query graph",
		description:
			"Query code-review-graph relationships: callers_of, callees_of, imports_of, importers_of, children_of, tests_for, inheritors_of, file_summary.",
		promptGuidelines: graphGuidelines,
		parameters: Type.Object({
			relation: Type.Union(
				[
					Type.Literal("callers_of"),
					Type.Literal("callees_of"),
					Type.Literal("imports_of"),
					Type.Literal("importers_of"),
					Type.Literal("children_of"),
					Type.Literal("tests_for"),
					Type.Literal("inheritors_of"),
					Type.Literal("file_summary"),
				],
				{ description: "Graph relation to query" },
			),
			target: Type.String({ description: "Node name, qualified name, or file path" }),
			repo: REPO_OPTIONAL,
		}),
		async execute(_id, params, signal, _onUpdate, ctx) {
			return runCrg(pi, ["query", params.relation, params.target], params.repo, ctx.cwd, signal);
		},
	});

	pi.registerTool({
		name: "crg_semantic_search",
		label: "CRG semantic search",
		description: "Search code-review-graph entities by name or keyword (FTS; embeddings when built).",
		promptGuidelines: graphGuidelines,
		parameters: Type.Object({
			query: Type.String({ description: "Search string" }),
			kind: Type.Optional(
				Type.Union([
					Type.Literal("File"),
					Type.Literal("Class"),
					Type.Literal("Function"),
					Type.Literal("Type"),
					Type.Literal("Test"),
				]),
			),
			limit: Type.Optional(Type.Number({ description: "Max results" })),
			repo: REPO_OPTIONAL,
		}),
		async execute(_id, params, signal, _onUpdate, ctx) {
			const args = ["search", params.query];
			if (params.kind) args.push("--kind", params.kind);
			if (params.limit !== undefined) args.push("--limit", String(params.limit));
			return runCrg(pi, args, params.repo, ctx.cwd, signal);
		},
	});

	pi.registerTool({
		name: "crg_architecture_overview",
		label: "CRG architecture overview",
		description: "High-level architecture map from code-review-graph communities and modules.",
		promptGuidelines: graphGuidelines,
		parameters: Type.Object({
			detail_level: Type.Optional(
				Type.Union([Type.Literal("minimal"), Type.Literal("standard")], {
					description: "Output verbosity",
				}),
			),
			repo: REPO_OPTIONAL,
		}),
		async execute(_id, params, signal, _onUpdate, ctx) {
			const args = ["architecture"];
			if (params.detail_level) args.push("--detail-level", params.detail_level);
			return runCrg(pi, args, params.repo, ctx.cwd, signal);
		},
	});

	pi.registerTool({
		name: "crg_status",
		label: "CRG status",
		description: "Show code-review-graph statistics for the repo (node/edge counts, schema version).",
		parameters: Type.Object({ repo: REPO_OPTIONAL }),
		async execute(_id, params, signal, _onUpdate, ctx) {
			return runCrg(pi, ["status"], params.repo, ctx.cwd, signal);
		},
	});

	pi.registerCommand("crg-build", {
		description: "Build or rebuild the code-review-graph for the current repo",
		handler: async (_args, ctx) => {
			const result = await runCrg(pi, ["build"], undefined, ctx.cwd, undefined);
			const text = result.content[0]?.text ?? "";
			ctx.ui.notify(text.slice(0, 500) || "build finished", result.details.exitCode === 0 ? "info" : "error");
		},
	});
}
