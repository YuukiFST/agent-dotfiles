#!/usr/bin/env node

/**
 * Projects a scanner's raw JSON report into ledger seeds on stdout.
 * Usage: node scanner-seeds.cjs --tool <gitleaks|semgrep|osv-scanner|zizmor> [--root <scanned-dir>] <raw-report.json>
 *
 * Raw reports carry the matched secret, the code around it, and commit authors, so they stay in
 * scratch. Each seed is built field by field from an allowlist (tool, rule_id, path, line, commit,
 * and for dependencies the package and severity), so a field the scanner adds later cannot reach
 * the output. Diagnostics name the tool and row, never a value.
 */

const path = require("path");
const { readFileWithinLimit } = require("./validate-findings.cjs");

const RULE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:/@+-]{0,199}$/;
const COMMIT = /^[0-9a-f]{7,64}$/;
const PACKAGE = /^[A-Za-z0-9@][A-Za-z0-9_.:/@+~-]{0,199}$/;
const USAGE = "Usage: node scanner-seeds.cjs --tool <gitleaks|semgrep|osv-scanner|zizmor> [--root <scanned-dir>] <raw-report.json>";

class SeedError extends Error {}

function requireMatch(value, pattern, location) {
  if (typeof value !== "string" || !pattern.test(value)) throw new SeedError(`${location}: unexpected value`);
  return value;
}

function requireLine(value, location) {
  if (!Number.isInteger(value) || value < 0) throw new SeedError(`${location}: expected a non-negative integer`);
  return value;
}

function isAbsolutePath(value) {
  return path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
}

function relativeSourcePath(value, root, location) {
  if (typeof value !== "string" || value.length === 0) throw new SeedError(`${location}: expected a path`);
  const normalized = value.replace(/\\/g, "/");
  const prefix = root === null ? null : `${root.replace(/\\/g, "/").replace(/\/+$/, "")}/`;
  const relative = prefix !== null && normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized.replace(/^\.\//, "");
  if (isAbsolutePath(relative) || relative.split("/").includes("..")) throw new SeedError(`${location}: path is outside the scanned directory; pass --root`);
  return relative;
}

function asArray(value, location) {
  if (!Array.isArray(value)) throw new SeedError(`${location}: expected an array`);
  return value;
}

function gitleaksSeeds(report, root) {
  return asArray(report, "report").map((finding, index) => {
    const location = `report[${index}]`;
    const seed = {
      tool: "gitleaks",
      rule_id: requireMatch(finding.RuleID, RULE_ID, `${location}.RuleID`),
      path: relativeSourcePath(finding.File, root, `${location}.File`),
      line: requireLine(finding.StartLine, `${location}.StartLine`),
    };
    if (finding.Commit) seed.commit = requireMatch(finding.Commit, COMMIT, `${location}.Commit`);
    return seed;
  });
}

function semgrepSeeds(report, root) {
  return asArray(report.results, "results").map((result, index) => {
    const location = `results[${index}]`;
    return {
      tool: "semgrep",
      rule_id: requireMatch(result.check_id, RULE_ID, `${location}.check_id`),
      path: relativeSourcePath(result.path, root, `${location}.path`),
      line: requireLine(result.start && result.start.line, `${location}.start.line`),
    };
  });
}

function osvScannerSeeds(report, root) {
  const seeds = [];
  asArray(report.results, "results").forEach((source, sourceIndex) => {
    const sourcePath = relativeSourcePath(source.source && source.source.path, root, `results[${sourceIndex}].source.path`);
    asArray(source.packages, `results[${sourceIndex}].packages`).forEach((entry, packageIndex) => {
      const location = `results[${sourceIndex}].packages[${packageIndex}]`;
      const info = entry.package || {};
      const name = requireMatch(info.name, PACKAGE, `${location}.package.name`);
      const version = requireMatch(info.version, PACKAGE, `${location}.package.version`);
      (entry.groups || []).forEach((group, groupIndex) => {
        const ids = asArray(group.ids, `${location}.groups[${groupIndex}].ids`);
        seeds.push({
          tool: "osv-scanner",
          rule_id: requireMatch(ids[0], RULE_ID, `${location}.groups[${groupIndex}].ids[0]`),
          path: sourcePath,
          package: `${name}@${version}`,
          max_severity: requireMatch(group.max_severity || "unknown", /^[0-9A-Za-z.]{1,16}$/, `${location}.groups[${groupIndex}].max_severity`),
        });
      });
    });
  });
  return seeds;
}

function zizmorSeeds(report, root) {
  return asArray(report, "report").map((finding, index) => {
    const location = `report[${index}]`;
    const locations = asArray(finding.locations, `${location}.locations`);
    const primary = locations.find((entry) => entry.symbolic && entry.symbolic.kind === "Primary") || locations[0];
    const key = primary && primary.symbolic && primary.symbolic.key;
    const row = primary && primary.concrete && primary.concrete.location && primary.concrete.location.start_point;
    return {
      tool: "zizmor",
      rule_id: requireMatch(finding.ident, RULE_ID, `${location}.ident`),
      path: relativeSourcePath(key && key.Local && key.Local.verbatim_path, root, `${location}.locations.symbolic.key`),
      line: requireLine(row && row.row, `${location}.locations.concrete.location.start_point.row`) + 1,
    };
  });
}

const PROJECTIONS = { gitleaks: gitleaksSeeds, semgrep: semgrepSeeds, "osv-scanner": osvScannerSeeds, zizmor: zizmorSeeds };

function uniqueSeeds(seeds) {
  const unique = new Map(seeds.map((seed) => [JSON.stringify(seed), seed]));
  return [...unique.keys()].sort().map((key) => unique.get(key));
}

function parseArguments(args) {
  const options = { tool: null, root: null, file: null };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--tool" || args[index] === "--root") {
      options[args[index].slice(2)] = args[++index] ?? null;
    } else if (options.file === null) {
      options.file = args[index];
    } else {
      return null;
    }
  }
  return options.file !== null && Object.hasOwn(PROJECTIONS, options.tool ?? "") ? options : null;
}

function run(args) {
  const options = parseArguments(args);
  if (options === null) {
    console.error(USAGE);
    return 1;
  }
  let report;
  try {
    report = JSON.parse(readFileWithinLimit(options.file));
  } catch {
    console.error("Failed to read the report: it could not be read or parsed safely");
    return 1;
  }
  try {
    const seeds = uniqueSeeds(PROJECTIONS[options.tool](report, options.root));
    console.log(JSON.stringify({ seeds }, null, 2));
    return 0;
  } catch (error) {
    if (!(error instanceof SeedError) && !(error instanceof TypeError)) throw error;
    console.error(`Failed to project the ${options.tool} report: ${error instanceof SeedError ? error.message : "unexpected shape"}`);
    return 1;
  }
}

if (require.main === module) process.exit(run(process.argv.slice(2)));
