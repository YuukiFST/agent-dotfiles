/**
 * Finding checks this copy of the skill adds to validate-findings.cjs: the refutation checklist,
 * capability tokens, the severity ceilings they imply, and the control case of a confirmed execution. validateDocument runs collectLocalFindingErrors after upstream's
 * own semantic checks, so the schema has already rejected unknown tokens.
 */

const SEVERITY_RANK = new Map([
  ["informational", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
  ["critical", 4],
]);

// Each capability lists the weaker capabilities it implies; holding one holds its closure.
const CAPABILITY_IMPLIES = Object.freeze({
  "principal:anonymous": [],
  "principal:authenticated_user": ["principal:anonymous", "read:own_data", "write:own_data"],
  "principal:tenant_admin": ["principal:authenticated_user"],
  "principal:system_admin": ["principal:tenant_admin"],
  "principal:trusted_controller": ["principal:system_admin", "write:config", "write:code", "exec:server_code"],
  "principal:local_user": ["principal:anonymous"],
  "read:own_data": [],
  "read:other_user_data": ["read:own_data"],
  "read:cross_tenant_data": ["read:other_user_data"],
  "read:all_data": ["read:cross_tenant_data"],
  "read:secret": [],
  "read:internal_network": [],
  "write:own_data": [],
  "write:other_user_data": ["write:own_data"],
  "write:cross_tenant_data": ["write:other_user_data"],
  "write:config": [],
  "write:code": [],
  "exec:other_user_browser": [],
  "exec:server_code": [],
  "exec:host_code": ["exec:server_code"],
  "session:other_user": ["principal:authenticated_user"],
  "session:any_user": ["session:other_user", "principal:system_admin"],
  "availability:shared_service": [],
});

const OWN_DATA = new Set(["read:own_data", "write:own_data"]);
const ADMIN_PRINCIPALS = new Set(["principal:tenant_admin", "principal:system_admin"]);
/// What an admin cannot already reach: a higher principal or any account, secrets, the internal network, a shared
// service other tenants use, other tenants' data, all data, or code.
const BEYOND_ADMIN = new Set([
  "principal:system_admin",
  "principal:trusted_controller",
  "session:any_user",
  "read:secret",
  "read:internal_network",
  "availability:shared_service",
  "read:cross_tenant_data",
  "write:cross_tenant_data",
  "read:all_data",
  "write:code",
  "exec:server_code",
  "exec:host_code",
]);

function capabilityClosure(tokens) {
  const held = new Set();
  const pending = [...tokens];
  while (pending.length > 0) {
    const token = pending.pop();
    if (held.has(token)) continue;
    held.add(token);
    pending.push(...(CAPABILITY_IMPLIES[token] || []));
  }
  return held;
}

function isTokenList(value) {
  return Array.isArray(value) && value.every((token) => typeof token === "string");
}

// The marginal capability is what the result grants beyond what the attacker already held.
function marginalCapabilities(capabilities) {
  const required = capabilityClosure(capabilities.requires);
  return [...capabilityClosure(capabilities.grants)].filter((token) => !required.has(token));
}

function severityCeiling(capabilities, marginal, modelDependent) {
  const principal = capabilities.requires.find((token) => token.startsWith("principal:"));
  const ceilings = [];
  if (modelDependent === true) ceilings.push(["high", "the result depends on probabilistic model behavior"]);
  if (marginal.length === 0) {
    ceilings.push(principal === "principal:trusted_controller"
      ? ["low", "a trusted controller gains nothing it did not already hold"]
      : ["medium", "every granted capability is already required, so the attacker gains nothing"]);
  } else if (marginal.every((token) => OWN_DATA.has(token))) {
    ceilings.push(["medium", "the attacker gains only its own data"]);
  }
  if (ADMIN_PRINCIPALS.has(principal) && !marginal.some((token) => BEYOND_ADMIN.has(token))) {
    ceilings.push(["medium", "an admin attacker gains no higher principal, any-user session, secret, internal network, shared service, cross-tenant access, all-data read, code write, or code execution"]);
  }
  return ceilings.reduce((lowest, ceiling) =>
    lowest === null || SEVERITY_RANK.get(ceiling[0]) < SEVERITY_RANK.get(lowest[0]) ? ceiling : lowest, null);
}

// In order: a NOT_APPLICABLE check refers to an earlier check in this list.
const REFUTATION_CHECKS = [
  "lower_trust_principal",
  "reachable_entrypoint",
  "control_bypassed",
  "crosses_boundary",
  "decided_by_visible_facts",
  "result_not_overstated",
  "beyond_best_practice",
  "marginal_capability",
];
// The statuses each verdict may not carry, and the one it must carry at least once.
const CHECKLIST_VERDICT_RULES = {
  confirmed: { forbidden: ["FAIL", "UNKNOWN"], needed: null },
  needs_validation: { forbidden: ["FAIL"], needed: "UNKNOWN" },
  rejected: { forbidden: [], needed: "FAIL" },
};
const CUTS_THE_PATH = new Set(["FAIL", "UNKNOWN"]);

function isCutBefore(check, statuses) {
  return REFUTATION_CHECKS.slice(0, REFUTATION_CHECKS.indexOf(check)).some((earlier) => CUTS_THE_PATH.has(statuses.get(earlier)));
}

// NOT_APPLICABLE means an earlier check is FAIL or UNKNOWN, or marks marginal_capability on a record whose grants
// add nothing; marginal_capability is PASS only when grants add something. hasMarginal is null without capabilities.
function collectChecklistErrors(finding, hasMarginal, base, isSafeRelativeSourcePath, errors) {
  const items = finding.refutation_checklist;
  const rules = CHECKLIST_VERDICT_RULES[finding.verdict];
  if (!Array.isArray(items) || !rules) return;
  const location = `${base}.refutation_checklist`;
  const counts = new Map(REFUTATION_CHECKS.map((check) => [check, 0]));
  const statuses = new Map();
  for (const item of items) {
    if (item && typeof item === "object" && counts.has(item.check) && !statuses.has(item.check)) statuses.set(item.check, item.status);
  }
  items.forEach((item, itemIndex) => {
    if (!item || typeof item !== "object" || !counts.has(item.check)) return;
    counts.set(item.check, counts.get(item.check) + 1);
    const at = `${location}[${itemIndex}]`;
    if (item.status !== "PASS" && item.reason === undefined) errors.push(`${at}.reason: required when status is ${JSON.stringify(item.status)}`);
    if ((item.file === undefined) !== (item.line === undefined)) errors.push(`${at}: file and line go together`);
    if (item.file !== undefined && !isSafeRelativeSourcePath(item.file)) errors.push(`${at}.file: must be a safe repository-relative source path`);
    if (item.status === "FAIL" && item.file === undefined) errors.push(`${at}: a FAIL cites the file and line that refute the check`);
    if (rules.forbidden.includes(item.status)) errors.push(`${at}.status: a ${finding.verdict} record cannot have a ${item.status} check`);
    const isMarginal = item.check === "marginal_capability";
    if (isMarginal && item.status === "PASS" && hasMarginal === false) {
      errors.push(`${at}.status: marginal_capability is PASS, but capabilities.grants adds nothing beyond capabilities.requires`);
    }
    if (item.status !== "NOT_APPLICABLE" || isCutBefore(item.check, statuses) || (isMarginal && hasMarginal === false)) return;
    errors.push(isMarginal && hasMarginal === true
      ? `${at}.status: marginal_capability is NOT_APPLICABLE, but capabilities.grants adds a capability; mark it PASS`
      : `${at}.status: ${item.check} is NOT_APPLICABLE, but no earlier check is FAIL or UNKNOWN`);
  });
  for (const [check, count] of counts) {
    if (count !== 1) errors.push(`${location}: check ${JSON.stringify(check)} must appear exactly once, got ${count}`);
  }
  if (rules.needed && !items.some((item) => item && item.status === rules.needed)) {
    errors.push(`${location}: a ${finding.verdict} record needs at least one ${rules.needed} check`);
  }
}

// A result that a repository fact establishes has no execution to control; every other kind ran a check that must
// be able to fail.
function collectControlCaseErrors(finding, base, errors) {
  const execution = finding.execution;
  if (finding.verdict !== "confirmed" || !execution || typeof execution !== "object") return;
  if (typeof execution.evidence_kind !== "string" || execution.evidence_kind === "source_observation") return;
  const control = execution.control;
  if (!control || typeof control !== "object") {
    errors.push(`${base}.execution.control: required when evidence_kind is ${JSON.stringify(execution.evidence_kind)}`);
    return;
  }
  if (typeof control.observed_result === "string" && typeof execution.observed_result === "string"
    && control.observed_result.trim() === execution.observed_result.trim()) {
    errors.push(`${base}.execution.control.observed_result: equals the attack's observed_result, so the check could not have failed`);
  }
}

// Returns well-formed capabilities with exactly one starting principal, or null after reporting why not.
function startingCapabilities(finding, base, errors) {
  const capabilities = finding.capabilities;
  if (!capabilities || !isTokenList(capabilities.requires) || !isTokenList(capabilities.grants)) return null;
  const principals = capabilities.requires.filter((token) => token.startsWith("principal:"));
  if (principals.length === 1) return capabilities;
  errors.push(`${base}.capabilities.requires: must name exactly one principal:* token, got ${principals.length}`);
  return null;
}

function collectLocalFindingErrors(findings, isSafeRelativeSourcePath) {
  const errors = [];
  if (!Array.isArray(findings)) return errors;
  findings.forEach((finding, index) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) return;
    const base = `$[${index}]`;
    collectControlCaseErrors(finding, base, errors);
    const capabilities = startingCapabilities(finding, base, errors);
    const marginal = capabilities && marginalCapabilities(capabilities);
    collectChecklistErrors(finding, marginal && marginal.length > 0, base, isSafeRelativeSourcePath, errors);
    if (!capabilities || finding.verdict !== "confirmed" || !finding.severity || typeof finding.severity !== "object") return;
    const overall = finding.severity.overall_severity;
    const ceiling = severityCeiling(capabilities, marginal, finding.severity.model_dependent);
    if (ceiling && SEVERITY_RANK.has(overall) && SEVERITY_RANK.get(overall) > SEVERITY_RANK.get(ceiling[0])) {
      errors.push(`${base}.severity.overall_severity: ${JSON.stringify(overall)} exceeds the ${JSON.stringify(ceiling[0])} ceiling: ${ceiling[1]}`);
    }
  });
  return errors;
}

module.exports = {
  CAPABILITY_IMPLIES,
  REFUTATION_CHECKS,
  capabilityClosure,
  collectLocalFindingErrors,
};
