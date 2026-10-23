const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { confirmed, needsValidation, rejected } = require("./findings-fixtures.cjs");

const scriptPath = path.join(__dirname, "export-sarif.cjs");
const CLI_TIMEOUT_MS = 5000;

function runExport(findings) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "export-sarif-"));
  try {
    const findingsPath = path.join(directory, "findings.json");
    fs.writeFileSync(findingsPath, JSON.stringify(findings));
    const result = spawnSync(process.execPath, [scriptPath, findingsPath], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
    return { ...result, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function confirmedAt(severity, cwe) {
  const finding = confirmed();
  finding.severity.impact.score = severity;
  finding.severity.overall_severity = severity;
  if (cwe) finding.cwe = cwe;
  return finding;
}

test("exports confirmed and needs_validation records as SARIF 2.1.0 and leaves rejected ones out", () => {
  const result = runExport([confirmedAt("medium", "CWE-639"), needsValidation(), rejected()]);
  assert.equal(result.status, 0, result.output);
  const sarif = JSON.parse(result.stdout);
  assert.equal(sarif.version, "2.1.0");
  const [run] = sarif.runs;
  assert.deepEqual(run.results.map((entry) => [entry.ruleId, entry.kind, entry.level]), [
    ["src-handler-missing-check", "fail", "warning"],
    ["src-parser-size-hypothesis", "review", "none"],
  ]);
  assert.deepEqual(run.tool.driver.rules.map((rule) => rule.id), ["src-handler-missing-check", "src-parser-size-hypothesis"]);

  const [found] = run.results;
  assert.deepEqual(found.locations[0].physicalLocation, {
    artifactLocation: { uri: "src/store.c", uriBaseId: "%SRCROOT%" },
    region: { startLine: 30 },
  });
  assert.deepEqual(found.codeFlows[0].threadFlows[0].locations.map((step) => step.location.physicalLocation.artifactLocation.uri),
    ["src/handler.c", "src/model.c", "src/store.c"]);
  assert.deepEqual(found.partialFingerprints, { "securityAuditFingerprint/v1": "src-handler-missing-check" });
  assert.deepEqual(run.tool.driver.rules[0].properties, { tags: ["security", "external/cwe/cwe-639"], "security-severity": "5.5" });
  assert.deepEqual(run.tool.driver.rules[1].properties, { tags: ["security"] });
  assert.equal(run.results[1].codeFlows, undefined);
});

test("maps each severity to a level and a GitHub security-severity score", () => {
  const expected = { critical: ["error", "9.5"], high: ["error", "8.0"], medium: ["warning", "5.5"], low: ["note", "2.0"], informational: ["note", "0.0"] };
  for (const [severity, [level, score]] of Object.entries(expected)) {
    const finding = confirmedAt(severity);
    finding.capabilities = { requires: ["principal:anonymous"], grants: ["exec:server_code"] };
    const result = runExport([finding]);
    assert.equal(result.status, 0, `${severity}: ${result.output}`);
    const run = JSON.parse(result.stdout).runs[0];
    assert.equal(run.results[0].level, level, severity);
    assert.equal(run.tool.driver.rules[0].properties["security-severity"], score, severity);
  }
});

test("refuses findings that fail validation, including a malformed CWE", () => {
  for (const findings of [[confirmedAt("medium", "CWE-0639")], [confirmedAt("medium", "79")], [{ verdict: "confirmed" }]]) {
    const result = runExport(findings);
    assert.equal(result.status, 1, result.output);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /does not pass validate-findings\.cjs/);
  }
});
