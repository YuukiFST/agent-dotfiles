const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const schema = require("./report-schema.json");
const { CAPABILITY_IMPLIES } = require("./finding-semantics.cjs");
const { checklist, confirmed, needsValidation, rejected } = require("./findings-fixtures.cjs");

const validatorPath = path.join(__dirname, "validate-findings.cjs");
const CLI_TIMEOUT_MS = 5000;

function runValidator(findings) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "finding-semantics-"));
  try {
    const findingsPath = path.join(directory, "findings.json");
    fs.writeFileSync(findingsPath, JSON.stringify(findings));
    const result = spawnSync(process.execPath, [validatorPath, findingsPath], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
    return { ...result, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function confirmedWith(requires, grants, severity, modelDependent = false) {
  const finding = confirmed();
  finding.capabilities = { requires, grants };
  finding.severity.impact.score = severity;
  finding.severity.overall_severity = severity;
  finding.severity.model_dependent = modelDependent;
  return finding;
}

test("accepts severity at or under every capability ceiling", () => {
  const cases = [
    confirmedWith(["principal:authenticated_user"], ["read:own_data"], "medium"),
    confirmedWith(["principal:trusted_controller"], ["write:config"], "low"),
    confirmedWith(["principal:anonymous"], ["read:own_data"], "medium"),
    confirmedWith(["principal:system_admin"], ["read:other_user_data"], "medium"),
    confirmedWith(["principal:tenant_admin"], ["read:cross_tenant_data"], "high"),
    confirmedWith(["principal:anonymous"], ["exec:server_code"], "critical"),
    confirmedWith(["principal:anonymous"], ["exec:server_code"], "high", true),
  ];
  for (const finding of cases) {
    const result = runValidator([finding]);
    assert.equal(result.status, 0, `${JSON.stringify(finding.capabilities)}: ${result.output}`);
  }
});

test("fails severity above each capability ceiling and names the reason", () => {
  const cases = [
    [confirmedWith(["principal:authenticated_user"], ["read:own_data"], "high"), /"high" exceeds the "medium" ceiling: every granted capability is already required/],
    [confirmedWith(["principal:trusted_controller"], ["write:config"], "medium"), /"medium" exceeds the "low" ceiling: a trusted controller gains nothing/],
    [confirmedWith(["principal:anonymous"], ["read:own_data"], "high"), /"high" exceeds the "medium" ceiling: the attacker gains only its own data/],
    [confirmedWith(["principal:system_admin"], ["read:other_user_data"], "high"), /"high" exceeds the "medium" ceiling: an admin attacker gains no cross-tenant access/],
    [confirmedWith(["principal:anonymous"], ["exec:server_code"], "critical", true), /"critical" exceeds the "high" ceiling: the result depends on probabilistic model behavior/],
  ];
  for (const [finding, message] of cases) {
    const result = runValidator([finding]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, new RegExp(`\\$\\[0\\]\\.severity\\.overall_severity: ${message.source}`));
  }
});

test("requires capabilities with exactly one starting principal", () => {
  const cases = [
    [(finding) => { delete finding.capabilities; }, /missing required field "capabilities"/],
    [(finding) => { finding.capabilities.requires = ["read:secret"]; }, /requires: must name exactly one principal:\* token, got 0/],
    [(finding) => { finding.capabilities.requires = ["principal:anonymous", "principal:local_user"]; }, /got 2/],
    [(finding) => { finding.capabilities.grants = ["read:invoice"]; }, /invalid value "read:invoice"/],
    [(finding) => { delete finding.severity.model_dependent; }, /missing required field "model_dependent"/],
  ];
  for (const [mutate, message] of cases) {
    const finding = confirmed();
    mutate(finding);
    const result = runValidator([finding]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, message);
  }
  const blocked = needsValidation();
  blocked.capabilities.requires = [];
  assert.equal(runValidator([blocked]).status, 1);
});

test("keeps the schema's capability enum aligned with the implication table", () => {
  const tokens = Object.keys(CAPABILITY_IMPLIES).sort();
  for (const branch of schema.items.oneOf.filter((candidate) => candidate.properties.capabilities)) {
    for (const list of ["requires", "grants"]) {
      assert.deepEqual([...branch.properties.capabilities.properties[list].items.enum].sort(), tokens);
    }
  }
  for (const implied of Object.values(CAPABILITY_IMPLIES).flat()) assert(tokens.includes(implied), implied);
});

function failing(check, status, extra = {}) {
  return { [check]: { check, status, reason: "Settled from source.", ...extra } };
}

test("accepts a needs_validation record whose checklist leaves a check UNKNOWN", () => {
  const blocked = needsValidation();
  blocked.refutation_checklist = checklist(failing("decided_by_visible_facts", "UNKNOWN"));
  const result = runValidator([blocked]);
  assert.equal(result.status, 0, result.output);
});

test("fails a checklist that does not fit its verdict", () => {
  const cases = [
    [confirmed, (finding) => { delete finding.refutation_checklist; }, /missing required field "refutation_checklist"/],
    [rejected, (finding) => { delete finding.refutation_checklist; }, /missing required field "refutation_checklist"/],
    [confirmed, (finding) => { finding.refutation_checklist = checklist(failing("crosses_boundary", "UNKNOWN")); }, /refutation_checklist\[3\]\.status: a confirmed record cannot have a UNKNOWN check/],
    [confirmed, (finding) => { finding.refutation_checklist = checklist(failing("crosses_boundary", "FAIL", { file: "src/a.c", line: 1 })); }, /a confirmed record cannot have a FAIL check/],
    [confirmed, (finding) => { finding.refutation_checklist = checklist({ crosses_boundary: { check: "crosses_boundary", status: "NOT_APPLICABLE" } }); }, /refutation_checklist\[3\]\.reason: required when status is "NOT_APPLICABLE"/],
    [confirmed, (finding) => { finding.refutation_checklist[7] = { check: "crosses_boundary", status: "PASS" }; }, /check "marginal_capability" must appear exactly once, got 0/],
    [rejected, (finding) => { finding.refutation_checklist = checklist(); }, /a rejected record needs at least one FAIL check/],
    [rejected, (finding) => { delete finding.refutation_checklist[2].file; delete finding.refutation_checklist[2].line; }, /a FAIL cites the file and line that refute the check; finding nothing is UNKNOWN/],
    [rejected, (finding) => { delete finding.refutation_checklist[2].line; }, /file and line go together/],
    [needsValidation, (finding) => { finding.refutation_checklist = checklist(); }, /a needs_validation record needs at least one UNKNOWN check/],
  ];
  for (const [factory, mutate, message] of cases) {
    const finding = factory();
    mutate(finding);
    const result = runValidator([finding]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, message);
  }
});
