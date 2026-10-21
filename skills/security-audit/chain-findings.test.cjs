const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { confirmed, needsValidation, rejected } = require("./findings-fixtures.cjs");

const scriptPath = path.join(__dirname, "chain-findings.cjs");
const CLI_TIMEOUT_MS = 5000;

function runChains(findings) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "chain-findings-"));
  try {
    const findingsPath = path.join(directory, "findings.json");
    fs.writeFileSync(findingsPath, JSON.stringify(findings));
    const result = spawnSync(process.execPath, [scriptPath, findingsPath], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
    return { ...result, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function confirmedStep(fingerprint, requires, grants, severity = "high") {
  const finding = confirmed();
  finding.fingerprint = fingerprint;
  finding.capabilities = { requires, grants };
  finding.severity.impact.score = severity;
  finding.severity.overall_severity = severity;
  return finding;
}

function blockedStep(fingerprint, requires, grants) {
  const finding = needsValidation();
  finding.fingerprint = fingerprint;
  finding.capabilities = { requires, grants };
  return finding;
}

test("lists a chain from an anonymous attacker through a takeover to code execution", () => {
  const findings = [
    confirmedStep("a-reset-token-leak", ["principal:anonymous"], ["session:other_user"]),
    confirmedStep("b-upload-runs-code", ["principal:authenticated_user"], ["exec:server_code"]),
    confirmedStep("c-own-profile-edit", ["principal:authenticated_user"], ["write:own_data"], "medium"),
  ];
  const result = runChains(findings);
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(JSON.parse(result.stdout), {
    start: "principal:anonymous",
    chains: [{ objectives: ["exec:server_code"], fingerprints: ["a-reset-token-leak", "b-upload-runs-code"], needs_validation: [] }],
  });
});

test("names needs_validation members and joins objectives one chain reaches", () => {
  const findings = [
    blockedStep("a-ssrf-metadata", ["principal:anonymous"], ["read:secret", "principal:system_admin"]),
    confirmedStep("b-admin-export", ["principal:system_admin"], ["read:all_data", "exec:server_code"], "critical"),
  ];
  const result = runChains(findings);
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(JSON.parse(result.stdout).chains, [{
    objectives: ["exec:server_code", "read:all_data"],
    fingerprints: ["a-ssrf-metadata", "b-admin-export"],
    needs_validation: ["a-ssrf-metadata"],
  }]);
});

test("lists nothing for a single-record path, an unreachable step, or a rejected record", () => {
  const findings = [
    confirmedStep("a-anonymous-rce", ["principal:anonymous"], ["exec:server_code"], "critical"),
    confirmedStep("b-needs-tenant-admin", ["principal:tenant_admin"], ["read:all_data"]),
    rejected(),
  ];
  const result = runChains(findings);
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(JSON.parse(result.stdout).chains, []);
});

test("refuses findings that fail validate-findings without an exception trace", () => {
  const finding = confirmed();
  delete finding.capabilities;
  const result = runChains([finding]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.stderr, /does not pass validate-findings\.cjs/);
  assert.doesNotMatch(result.output, /TypeError|at chain-findings/);
});
