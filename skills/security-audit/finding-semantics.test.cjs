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

function confirmedWith(requires, grants, severity, { modelDependent = false, marginal = "PASS" } = {}) {
  const finding = confirmed();
  finding.capabilities = { requires, grants };
  finding.severity.impact.score = severity;
  finding.severity.overall_severity = severity;
  finding.severity.model_dependent = modelDependent;
  if (marginal !== "PASS") {
    finding.refutation_checklist = checklist({ marginal_capability: { check: "marginal_capability", status: marginal, reason: "Grants adds nothing." } });
  }
  return finding;
}

const NO_GAIN = { marginal: "NOT_APPLICABLE" };

test("regression: an admin who reaches a higher principal, any account, a secret, or the internal network is not capped at medium", () => {
  for (const finding of [
    confirmedWith(["principal:tenant_admin"], ["principal:system_admin"], "high"),
    confirmedWith(["principal:tenant_admin"], ["session:any_user"], "critical"),
    confirmedWith(["principal:system_admin"], ["read:secret"], "high"),
    confirmedWith(["principal:tenant_admin"], ["read:internal_network"], "high"),
    confirmedWith(["principal:tenant_admin"], ["availability:shared_service"], "high"),
  ]) {
    const result = runValidator([finding]);
    assert.equal(result.status, 0, `${JSON.stringify(finding.capabilities)}: ${result.output}`);
  }
});

test("accepts severity at or under every capability ceiling", () => {
  const cases = [
    confirmedWith(["principal:authenticated_user"], ["read:own_data"], "medium", NO_GAIN),
    confirmedWith(["principal:trusted_controller"], ["write:config"], "low", NO_GAIN),
    confirmedWith(["principal:anonymous"], ["read:own_data"], "medium"),
    confirmedWith(["principal:system_admin"], ["read:other_user_data"], "medium"),
    confirmedWith(["principal:tenant_admin"], ["read:cross_tenant_data"], "high"),
    confirmedWith(["principal:anonymous"], ["exec:server_code"], "critical"),
    confirmedWith(["principal:anonymous"], ["exec:server_code"], "high", { modelDependent: true }),
    confirmedWith(["principal:tenant_admin"], ["principal:system_admin"], "high"),
    confirmedWith(["principal:tenant_admin"], ["session:any_user"], "critical"),
    confirmedWith(["principal:system_admin"], ["read:secret"], "high"),
  ];
  for (const finding of cases) {
    const result = runValidator([finding]);
    assert.equal(result.status, 0, `${JSON.stringify(finding.capabilities)}: ${result.output}`);
  }
});

test("fails severity above each capability ceiling and names the reason", () => {
  const cases = [
    [confirmedWith(["principal:authenticated_user"], ["read:own_data"], "high", NO_GAIN), /"high" exceeds the "medium" ceiling: every granted capability is already required/],
    [confirmedWith(["principal:trusted_controller"], ["write:config"], "medium", NO_GAIN), /"medium" exceeds the "low" ceiling: a trusted controller gains nothing/],
    [confirmedWith(["principal:anonymous"], ["read:own_data"], "high"), /"high" exceeds the "medium" ceiling: the attacker gains only its own data/],
    [confirmedWith(["principal:system_admin"], ["read:other_user_data"], "high"), /"high" exceeds the "medium" ceiling: an admin attacker gains no higher principal/],
    [confirmedWith(["principal:tenant_admin"], ["write:config"], "high"), /"high" exceeds the "medium" ceiling: an admin attacker gains no higher principal/],
    [confirmedWith(["principal:anonymous"], ["exec:server_code"], "critical", { modelDependent: true }), /"critical" exceeds the "high" ceiling: the result depends on probabilistic model behavior/],
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

test("regression: a confirmed checklist cannot pass by skipping checks or claiming a gain the capabilities lack", () => {
  const cases = [
    [confirmed(), (finding) => { finding.refutation_checklist = checklist(failing("control_bypassed", "NOT_APPLICABLE")); }, /refutation_checklist\[2\]\.status: control_bypassed is NOT_APPLICABLE, but no earlier check is FAIL or UNKNOWN/],
    [confirmedWith(["principal:authenticated_user"], ["read:own_data"], "medium"), () => {}, /marginal_capability is PASS, but capabilities\.grants adds nothing beyond capabilities\.requires/],
    [confirmed(), (finding) => { finding.refutation_checklist = checklist(failing("marginal_capability", "NOT_APPLICABLE")); }, /marginal_capability is NOT_APPLICABLE, but capabilities\.grants adds a capability/],
  ];
  for (const [finding, mutate, message] of cases) {
    mutate(finding);
    const result = runValidator([finding]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, message);
  }
  const rejectedEarly = rejected();
  rejectedEarly.refutation_checklist[7] = { check: "marginal_capability", status: "NOT_APPLICABLE", reason: "The path stops at control_bypassed." };
  assert.equal(runValidator([rejectedEarly]).status, 0);
});

test("regression: NOT_APPLICABLE needs an earlier FAIL or UNKNOWN in checklist order", () => {
  const blocked = needsValidation();
  blocked.refutation_checklist = checklist({
    ...failing("lower_trust_principal", "NOT_APPLICABLE"),
    ...failing("marginal_capability", "UNKNOWN"),
  });
  const result = runValidator([blocked]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.stderr, /refutation_checklist\[0\]\.status: lower_trust_principal is NOT_APPLICABLE, but no earlier check is FAIL or UNKNOWN/);
  blocked.refutation_checklist = checklist({
    ...failing("reachable_entrypoint", "UNKNOWN"),
    ...failing("crosses_boundary", "NOT_APPLICABLE"),
  });
  assert.equal(runValidator([blocked]).status, 0);
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
    [rejected, (finding) => { delete finding.refutation_checklist[2].file; delete finding.refutation_checklist[2].line; }, /a FAIL cites the file and line that refute the check/],
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

test("accepts a repository-fact result without a control case and every local kind with one", () => {
  const sourceFact = confirmed();
  sourceFact.execution.evidence_kind = "source_observation";
  delete sourceFact.execution.control;
  const cases = [sourceFact];
  for (const kind of ["local_differential", "local_state_readback", "local_artifact", "sanitizer_report", "rendered_policy"]) {
    const finding = confirmed();
    finding.execution.evidence_kind = kind;
    cases.push(finding);
  }
  for (const finding of cases) {
    const result = runValidator([finding]);
    assert.equal(result.status, 0, `${finding.execution.evidence_kind}: ${result.output}`);
  }
});

test("fails a confirmed record that lacks its evidence kind, control case, counterevidence, or severity change conditions", () => {
  const cases = [
    [(finding) => { delete finding.execution.evidence_kind; }, /missing required field "evidence_kind"/],
    [(finding) => { finding.execution.evidence_kind = "model_judgement"; }, /evidence_kind/],
    [(finding) => { delete finding.execution.control; }, /execution\.control: required when evidence_kind is "local_state_readback"/],
    [(finding) => { delete finding.counterevidence; }, /missing required field "counterevidence"/],
    [(finding) => { finding.counterevidence = " "; }, /counterevidence/],
    [(finding) => { delete finding.severity.change_conditions; }, /missing required field "change_conditions"/],
  ];
  for (const [mutate, message] of cases) {
    const finding = confirmed();
    mutate(finding);
    const result = runValidator([finding]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, message);
  }
});

test("fails a control case with the attack's own result", () => {
  const finding = confirmed();
  finding.execution.control.observed_result = ` ${finding.execution.observed_result} `;
  const result = runValidator([finding]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.stderr, /execution\.control\.observed_result: equals the attack's observed_result, so the check could not have failed/);
});
