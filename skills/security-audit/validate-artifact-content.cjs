#!/usr/bin/env node

/**
 * Fails run artifacts that carry a secret, personal data, or a real host.
 * Usage: node validate-artifact-content.cjs [--rules <rules-of-engagement.json>] <artifact>...
 *
 * Every string of a .json artifact, or every line of any other artifact, is scanned by the
 * built-in detectors plus the rules file's deny detectors. Each hit fails unless an allow rule
 * names its detector and matches its value, so an absent rules file allows nothing.
 * Diagnostics name the detector and location, never the value.
 */

const path = require("path");
const { LIMITS, UNSAFE_DIAGNOSTIC_CHARACTER, readFileWithinLimit } = require("./validate-findings.cjs");

const ALNUM_BEFORE = "(?<![0-9A-Za-z])";
const ALNUM_AFTER = "(?![0-9A-Za-z])";
const RESERVED_HOST_NAME = /^(?:localhost|example\.(?:com|net|org))$|\.(?:localhost|test|example|invalid)$|\.example\.(?:com|net|org)$/;
// Loopback, "this network", and the RFC 5737 documentation ranges never identify a real host.
const RESERVED_IPV4 = ["127.0.0.0/8", "0.0.0.0/8", "192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24"];
// Weakness and vulnerability catalogs a remediation cites; they never come from the target.
const PUBLIC_REFERENCE_HOST = /^(?:(?:cwe|capec|attack)\.mitre\.org|(?:[a-z0-9-]+\.)*owasp\.org|nvd\.nist\.gov|(?:www\.)?cve\.org)$/;
const CNPJ_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function parseIpv4(value) {
  const octets = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!octets || octets.slice(1).some((octet) => Number(octet) > 255)) return null;
  return octets.slice(1).reduce((address, octet) => address * 256 + Number(octet), 0);
}

function parseCidr(value) {
  const [base, bits, extra] = String(value).split("/");
  const address = parseIpv4(base);
  const prefix = Number(bits);
  if (address === null || extra !== undefined || !/^\d{1,2}$/.test(bits || "") || prefix > 32) return null;
  const size = 2 ** (32 - prefix);
  return { start: address - (address % size), size };
}

function inCidr(address, cidr) {
  return address >= cidr.start && address < cidr.start + cidr.size;
}

const RESERVED_IPV4_RANGES = RESERVED_IPV4.map(parseCidr);

function isReservedHost(host) {
  const name = host.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (name === "::1" || RESERVED_HOST_NAME.test(name)) return true;
  const address = parseIpv4(name);
  return address !== null && RESERVED_IPV4_RANGES.some((range) => inCidr(address, range));
}

function isPublicReferenceHost(host) {
  return PUBLIC_REFERENCE_HOST.test(host.replace(/\.$/, "").toLowerCase());
}

// Brazilian check digits: weighted sum mod 11, with remainders 0 and 1 giving digit 0.
function checkDigit(values, weights) {
  const remainder = values.reduce((sum, value, index) => sum + value * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCpf(match) {
  const digits = match.replace(/\D/g, "").split("").map(Number);
  if (new Set(digits).size === 1) return false;
  const first = checkDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits[9] === first && digits[10] === second;
}

// The alphanumeric CNPJ (RFB Nota Técnica COCAD/SUARA/RFB 49/2024) values each character as its
// ASCII code minus 48, which leaves the numeric CNPJ's digits and check digits unchanged.
function isValidCnpj(match) {
  const characters = match.replace(/[./-]/g, "");
  if (new Set(characters).size === 1) return false;
  const values = characters.split("").map((character) => character.charCodeAt(0) - 48);
  const first = checkDigit(values.slice(0, 12), CNPJ_WEIGHTS.slice(1));
  const second = checkDigit(values.slice(0, 13), CNPJ_WEIGHTS);
  return values[12] === first && values[13] === second;
}

const BUILT_IN_DETECTORS = [
  { name: "private-key", pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g },
  { name: "aws-access-key", pattern: new RegExp(`${ALNUM_BEFORE}AKIA[0-9A-Z]{16}${ALNUM_AFTER}`, "g") },
  { name: "stripe-live-key", pattern: new RegExp(`${ALNUM_BEFORE}[rs]k_live_[0-9A-Za-z]{8,}`, "g") },
  { name: "github-token", pattern: new RegExp(`${ALNUM_BEFORE}(?:gh[opsru]_[0-9A-Za-z]{36,}|github_pat_[0-9A-Za-z_]{22,})`, "g") },
  { name: "slack-token", pattern: new RegExp(`${ALNUM_BEFORE}xox[abposr]-[0-9A-Za-z-]{10,}`, "g") },
  { name: "jwt", pattern: /(?<![0-9A-Za-z_-])eyJ[0-9A-Za-z_-]{4,}\.[0-9A-Za-z_-]{4,}\.[0-9A-Za-z_-]{4,}/g },
  { name: "url-credentials", pattern: /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s/?#@:]+:[^\s/?#@]+@/g },
  { name: "cpf", pattern: new RegExp(`${ALNUM_BEFORE}\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}${ALNUM_AFTER}`, "g"), keep: isValidCpf },
  { name: "cnpj", pattern: new RegExp(`${ALNUM_BEFORE}[0-9A-Z]{2}\\.?[0-9A-Z]{3}\\.?[0-9A-Z]{3}/?[0-9A-Z]{4}-?\\d{2}${ALNUM_AFTER}`, "g"), keep: isValidCnpj },
  { name: "email", pattern: /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?![A-Za-z0-9-]))/g, keep: (_, match) => !isReservedHost(match[1]) },
  { name: "host", pattern: /[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^\s/?#@]*@)?(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+)/g, group: 1, keep: (host) => !isReservedHost(host) && !isPublicReferenceHost(host) },
  { name: "host", pattern: /(?<![0-9A-Za-z.])(?:\d{1,3}\.){3}\d{1,3}(?![0-9A-Za-z]|\.[0-9A-Za-z])/g, keep: (host) => parseIpv4(host) !== null && !isReservedHost(host) },
];

class RulesError extends Error {}

function compileRulePattern(value, location) {
  if (typeof value !== "string" || value.length === 0) throw new RulesError(`${location}: expected a non-empty regular expression string`);
  try {
    return new RegExp(value, "gu");
  } catch {
    throw new RulesError(`${location}: invalid regular expression`);
  }
}

function checkKeys(rule, allowed, location) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new RulesError(`${location}: expected an object`);
  const extra = Object.keys(rule).find((key) => !allowed.includes(key));
  if (extra !== undefined) throw new RulesError(`${location}: unexpected field ${JSON.stringify(extra)}`);
}

function parseRules(document) {
  checkKeys(document, ["allow", "deny"], "rules");
  if (!Array.isArray(document.allow || []) || !Array.isArray(document.deny || [])) throw new RulesError("rules: allow and deny must be arrays");
  const deny = (document.deny || []).map((rule, index) => {
    const location = `rules.deny[${index}]`;
    checkKeys(rule, ["name", "match"], location);
    if (typeof rule.name !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(rule.name) || BUILT_IN_DETECTORS.some((detector) => detector.name === rule.name)) {
      throw new RulesError(`${location}.name: expected a new lowercase detector name`);
    }
    return { name: rule.name, pattern: compileRulePattern(rule.match, `${location}.match`) };
  });
  const detectorNames = new Set([...BUILT_IN_DETECTORS, ...deny].map((detector) => detector.name));
  const allow = (document.allow || []).map((rule, index) => {
    const location = `rules.allow[${index}]`;
    checkKeys(rule, ["detector", "match", "cidr", "fields"], location);
    if (!detectorNames.has(rule.detector)) throw new RulesError(`${location}.detector: names no detector`);
    if ((rule.match === undefined) === (rule.cidr === undefined)) throw new RulesError(`${location}: needs exactly one of "match" or "cidr"`);
    if (rule.fields !== undefined && (!Array.isArray(rule.fields) || rule.fields.length === 0 || rule.fields.some((field) => typeof field !== "string"))) {
      throw new RulesError(`${location}.fields: expected a non-empty array of field paths`);
    }
    const cidr = rule.cidr === undefined ? null : parseCidr(rule.cidr);
    if (rule.cidr !== undefined && cidr === null) throw new RulesError(`${location}.cidr: expected an IPv4 CIDR such as 10.0.0.0/8`);
    const pattern = rule.match === undefined ? null : compileRulePattern(rule.match, `${location}.match`);
    // Anchored, so an allow rule names whole values and a fragment such as "acme" admits nothing.
    return { detector: rule.detector, pattern: pattern && new RegExp(`^(?:${pattern.source})$`, "u"), cidr, fields: rule.fields || null };
  });
  return { allow, deny };
}

function isAllowed(hit, field, allowRules) {
  return allowRules.some((rule) => {
    if (rule.detector !== hit.name || (rule.fields && !rule.fields.includes(field))) return false;
    if (rule.pattern) return rule.pattern.test(hit.value);
    const address = parseIpv4(hit.value);
    return address !== null && inCidr(address, rule.cidr);
  });
}

function deniedHits(text, field, rules) {
  const seen = new Set();
  const denied = [];
  for (const detector of [...BUILT_IN_DETECTORS, ...rules.deny]) {
    for (const match of text.matchAll(detector.pattern)) {
      const value = match[detector.group || 0];
      if (detector.keep && !detector.keep(value, match)) continue;
      const hit = { name: detector.name, value };
      const key = `${hit.name}\u0000${value}`;
      if (seen.has(key) || isAllowed(hit, field, rules.allow)) continue;
      seen.add(key);
      denied.push(hit.name);
    }
  }
  return denied;
}

// Yields every string value with its JSON path and the index-free field path allow rules name.
function* jsonStrings(document) {
  const stack = [{ value: document, location: "$", field: [] }];
  while (stack.length > 0) {
    const { value, location, field } = stack.pop();
    if (typeof value === "string") {
      yield { location, field: field.join("."), text: value };
    } else if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index--) stack.push({ value: value[index], location: `${location}[${index}]`, field });
    } else if (value !== null && typeof value === "object") {
      for (const key of Object.keys(value).reverse()) {
        const step = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
        stack.push({ value: value[key], location: `${location}${step}`, field: [...field, key] });
      }
    }
  }
}

function* artifactStrings(file, contents) {
  if (path.extname(file).toLowerCase() === ".json") {
    yield* jsonStrings(JSON.parse(contents));
    return;
  }
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index++) yield { location: `line ${index + 1}`, field: "text", text: lines[index] };
}

function collectContentErrors(file, contents, rules, errors) {
  const label = JSON.stringify(path.basename(file)).replace(UNSAFE_DIAGNOSTIC_CHARACTER, "?");
  for (const { location, field, text } of artifactStrings(file, contents)) {
    for (const name of deniedHits(text, field, rules)) {
      if (errors.length >= LIMITS.validationErrors) return;
      errors.push(`${label} ${location.replace(UNSAFE_DIAGNOSTIC_CHARACTER, "?")}: ${name}`);
    }
  }
}

function run(args) {
  let rulesFile = null;
  let artifacts = args;
  if (args[0] === "--rules") {
    rulesFile = args[1];
    artifacts = args.slice(2);
  }
  if ((args[0] === "--rules" && !rulesFile) || artifacts.length === 0) {
    console.error("Usage: node validate-artifact-content.cjs [--rules <rules-of-engagement.json>] <artifact>...");
    return 1;
  }

  let rules = { allow: [], deny: [] };
  if (rulesFile) {
    try {
      rules = parseRules(JSON.parse(readFileWithinLimit(rulesFile)));
    } catch (error) {
      console.error(`Failed to load rules of engagement: ${error instanceof RulesError ? error.message : "file could not be read or parsed safely"}`);
      return 1;
    }
  }

  const errors = [];
  for (const file of artifacts) {
    try {
      collectContentErrors(file, readFileWithinLimit(file), rules, errors);
    } catch {
      console.error("Failed to scan an artifact: it could not be read or parsed safely");
      return 1;
    }
  }
  for (const message of errors) console.error("ERROR:", message);
  if (errors.length > 0) {
    const cap = errors.length === LIMITS.validationErrors ? `; output capped at ${LIMITS.validationErrors}` : "";
    console.error(`FAIL: ${errors.length} secret, personal-data, or host value(s)${cap}. Cite each by type and file:line, or allow a dummy value in the rules of engagement.`);
    return 1;
  }
  console.log(`PASS: ${artifacts.length} artifact(s) carry no denied value`);
  return 0;
}

if (require.main === module) process.exit(run(process.argv.slice(2)));
