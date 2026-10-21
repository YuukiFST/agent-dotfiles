#!/usr/bin/env node

/**
 * Lists chains of findings that take an anonymous attacker to a critical objective.
 * Usage: node chain-findings.cjs <path-to-findings.json>
 *
 * Starting from principal:anonymous, every confirmed or needs_validation record whose
 * capabilities.requires is already held adds its capabilities.grants, layer by layer, in
 * fingerprint order. For each critical objective reached, the chain is the set of records that
 * first produced each capability the objective depends on. Only chains of two or more records are
 * printed, as JSON on stdout, each with its fingerprint: "chain:" plus the member fingerprints joined
 * by "+". A chain whose fingerprint already has a record is left out, so a validated or rejected
 * chain is not proposed again. A chain is a candidate for independent validation, never a finding.
 */

const fs = require("fs");
const path = require("path");
const { capabilityClosure } = require("./finding-semantics.cjs");
const { readFileWithinLimit, validateDocument } = require("./validate-findings.cjs");

const START = "principal:anonymous";
// The critical severity anchors in SKILL.md: code execution, full data-store access, takeover of any account.
const OBJECTIVES = ["exec:server_code", "read:all_data", "session:any_user"];
const CHAINED_VERDICTS = new Set(["confirmed", "needs_validation"]);

function buildCapabilityGraph(findings) {
  const records = findings.filter((finding) => CHAINED_VERDICTS.has(finding.verdict));
  const producers = new Map([...capabilityClosure([START])].map((token) => [token, null]));
  const layers = new Map();
  for (let layer = 0; ; layer++) {
    const applicable = records.filter((record) =>
      !layers.has(record.fingerprint) && record.capabilities.requires.every((token) => producers.has(token)));
    if (applicable.length === 0) break;
    for (const record of applicable) layers.set(record.fingerprint, layer);
    for (const record of applicable) {
      for (const token of [...capabilityClosure(record.capabilities.grants)].sort()) {
        if (!producers.has(token)) producers.set(token, record);
      }
    }
  }
  return { producers, layers };
}

function chainTo(objective, { producers, layers }) {
  const members = new Map();
  const pending = [objective];
  while (pending.length > 0) {
    const record = producers.get(pending.pop());
    if (!record || members.has(record.fingerprint)) continue;
    members.set(record.fingerprint, record);
    pending.push(...record.capabilities.requires);
  }
  return [...members.values()].sort((left, right) =>
    layers.get(left.fingerprint) - layers.get(right.fingerprint) || (left.fingerprint < right.fingerprint ? -1 : 1));
}

function listChains(findings) {
  const graph = buildCapabilityGraph(findings);
  const recorded = new Set(findings.map((finding) => finding.fingerprint));
  const chains = new Map();
  for (const objective of OBJECTIVES.filter((token) => graph.producers.get(token))) {
    const members = chainTo(objective, graph);
    if (members.length < 2) continue;
    const fingerprint = `chain:${members.map((record) => record.fingerprint).join("+")}`;
    if (recorded.has(fingerprint)) continue;
    if (!chains.has(fingerprint)) {
      chains.set(fingerprint, {
        fingerprint,
        objectives: [],
        fingerprints: members.map((record) => record.fingerprint),
        needs_validation: members.filter((record) => record.verdict === "needs_validation").map((record) => record.fingerprint),
      });
    }
    chains.get(fingerprint).objectives.push(objective);
  }
  return [...chains.values()];
}

function run(file) {
  if (!file) {
    console.error("Usage: node chain-findings.cjs <path-to-findings.json>");
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
  console.log(JSON.stringify({ start: START, chains: listChains(findings) }, null, 2));
  return 0;
}

if (require.main === module) process.exit(run(process.argv[2]));
