#!/usr/bin/env node

/**
 * Converts a valid findings.json into SARIF 2.1.0 on stdout.
 * Usage: node export-sarif.cjs <path-to-findings.json>
 *
 * Each confirmed record becomes a result of kind "fail" whose level and security-severity follow
 * overall_severity; each needs_validation record becomes a result of kind "review" at level "none",
 * since it has no severity and SARIF allows only "none" outside kind "fail". Rejected records are
 * left out. The last trace entry is the result's location, a trace of two or more entries becomes
 * its code flow, the fingerprint is its partial
 * fingerprint, and an optional cwe becomes a rule tag. Writing the output is the caller's choice;
 * the script never uploads anything.
 */

const fs = require("fs");
const path = require("path");
const { readFileWithinLimit, validateDocument } = require("./validate-findings.cjs");

const EXPORTED_VERDICTS = new Set(["confirmed", "needs_validation"]);
// GitHub code scanning reads security-severity as a CVSS-like score: 9.0+ critical, 7.0+ high, 4.0+ medium, 0.1+ low.
const SEVERITY_SCORE = { critical: "9.5", high: "8.0", medium: "5.5", low: "2.0", informational: "0.0" };
const SEVERITY_LEVEL = { critical: "error", high: "error", medium: "warning", low: "note", informational: "note" };

function physicalLocation(citation) {
  return {
    physicalLocation: {
      artifactLocation: { uri: citation.file, uriBaseId: "%SRCROOT%" },
      region: { startLine: citation.line },
    },
    message: { text: citation.description },
  };
}

function ruleFor(finding) {
  const tags = ["security"];
  if (finding.cwe) tags.push(`external/cwe/${finding.cwe.toLowerCase()}`);
  const properties = { tags };
  if (finding.verdict === "confirmed") properties["security-severity"] = SEVERITY_SCORE[finding.severity.overall_severity];
  return {
    id: finding.fingerprint,
    name: finding.fingerprint,
    shortDescription: { text: finding.title },
    fullDescription: { text: finding.root_cause || finding.claimed_root_cause },
    properties,
  };
}

function resultFor(finding) {
  const isConfirmed = finding.verdict === "confirmed";
  const result = {
    ruleId: finding.fingerprint,
    kind: isConfirmed ? "fail" : "review",
    level: isConfirmed ? SEVERITY_LEVEL[finding.severity.overall_severity] : "none",
    message: { text: `${finding.title}: ${finding.description}` },
    locations: [physicalLocation(finding.trace[finding.trace.length - 1])],
    partialFingerprints: { "securityAuditFingerprint/v1": finding.fingerprint },
  };
  if (finding.trace.length > 1) {
    result.codeFlows = [{ threadFlows: [{ locations: finding.trace.map((step) => ({ location: physicalLocation(step) })) }] }];
  }
  return result;
}

function toSarif(findings) {
  const exported = findings
    .filter((finding) => EXPORTED_VERDICTS.has(finding.verdict))
    .sort((left, right) => (left.fingerprint < right.fingerprint ? -1 : left.fingerprint > right.fingerprint ? 1 : 0));
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "security-audit", rules: exported.map(ruleFor) } },
      results: exported.map(resultFor),
    }],
  };
}

function run(file) {
  if (!file) {
    console.error("Usage: node export-sarif.cjs <path-to-findings.json>");
    return 1;
  }
  let findings;
  try {
    findings = JSON.parse(readFileWithinLimit(file));
  } catch {
    console.error("Failed to read findings JSON: input could not be opened, read, or parsed safely");
    return 1;
  }
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "report-schema.json"), "utf8"));
  if (validateDocument(findings, schema).length > 0) {
    console.error("findings.json does not pass validate-findings.cjs; fix those errors first");
    return 1;
  }
  console.log(JSON.stringify(toSarif(findings), null, 2));
  return 0;
}

if (require.main === module) process.exit(run(process.argv[2]));
