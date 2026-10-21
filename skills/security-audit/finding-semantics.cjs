/**
 * Finding checks this copy of the skill adds to validate-findings.cjs: capability tokens and the
 * severity ceilings they imply. validateDocument runs collectLocalFindingErrors after upstream's
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
const BEYOND_ADMIN = new Set(["read:cross_tenant_data", "write:cross_tenant_data", "read:all_data", "exec:server_code", "exec:host_code"]);

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
function severityCeiling(capabilities, modelDependent) {
  const required = capabilityClosure(capabilities.requires);
  const marginal = [...capabilityClosure(capabilities.grants)].filter((token) => !required.has(token));
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
    ceilings.push(["medium", "an admin attacker gains no cross-tenant access, all-data read, or code execution"]);
  }
  return ceilings.reduce((lowest, ceiling) =>
    lowest === null || SEVERITY_RANK.get(ceiling[0]) < SEVERITY_RANK.get(lowest[0]) ? ceiling : lowest, null);
}

function collectLocalFindingErrors(findings) {
  const errors = [];
  if (!Array.isArray(findings)) return errors;
  findings.forEach((finding, index) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) return;
    const capabilities = finding.capabilities;
    if (!capabilities || !isTokenList(capabilities.requires) || !isTokenList(capabilities.grants)) return;
    const base = `$[${index}]`;
    const principals = capabilities.requires.filter((token) => token.startsWith("principal:"));
    if (principals.length !== 1) {
      errors.push(`${base}.capabilities.requires: must name exactly one principal:* token, got ${principals.length}`);
      return;
    }
    if (finding.verdict !== "confirmed" || !finding.severity || typeof finding.severity !== "object") return;
    const overall = finding.severity.overall_severity;
    const ceiling = severityCeiling(capabilities, finding.severity.model_dependent);
    if (ceiling && SEVERITY_RANK.has(overall) && SEVERITY_RANK.get(overall) > SEVERITY_RANK.get(ceiling[0])) {
      errors.push(`${base}.severity.overall_severity: ${JSON.stringify(overall)} exceeds the ${JSON.stringify(ceiling[0])} ceiling: ${ceiling[1]}`);
    }
  });
  return errors;
}

module.exports = {
  CAPABILITY_IMPLIES,
  capabilityClosure,
  collectLocalFindingErrors,
};
