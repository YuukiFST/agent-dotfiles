#!/usr/bin/env node

/**
 * Checks that every trace[], evidence[], and refutation_checklist[] citation in findings.json
 * exists in the target.
 * Usage: node validate-citations.cjs [--print-hashes] <path-to-findings.json> <target-root>
 *
 * A citation passes when its path names a regular file under the target without crossing a
 * symlink, its line is within the file, and its optional snippet_sha256 matches the cited line.
 * --print-hashes prints the snippet_sha256 of every citation after a passing check.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  LIMITS,
  SafeInputError,
  UNSAFE_DIAGNOSTIC_CHARACTER,
  isSafeRelativeSourcePath,
  readBytesWithinLimit,
  readFileWithinLimit,
} = require("./validate-findings.cjs");

const CITATION_FIELDS = ["trace", "evidence"];
const SNIPPET_HASH = /^[0-9a-f]{64}$/;
const LINE_FEED = 0x0a;
const TRIMMED_BYTES = new Set([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20]);

function quote(value) {
  return JSON.stringify(String(value)).replace(UNSAFE_DIAGNOSTIC_CHARACTER, (character) =>
    `\\u{${character.codePointAt(0).toString(16)}}`);
}

// Every cited location: each trace and evidence entry, and each refutation_checklist item with a file.
function citationsOf(finding) {
  const citations = [];
  for (const field of CITATION_FIELDS) {
    finding[field].forEach((citation, index) => citations.push({ location: `${field}[${index}]`, citation }));
  }
  (finding.refutation_checklist || []).forEach((item, index) => {
    if (item && typeof item === "object" && item.file !== undefined) citations.push({ location: `refutation_checklist[${index}]`, citation: item });
  });
  return citations;
}

function isCitation(citation) {
  return Boolean(citation) && typeof citation === "object" &&
    isSafeRelativeSourcePath(citation.file) &&
    Number.isInteger(citation.line) && citation.line >= 1 &&
    (citation.snippet_sha256 === undefined || SNIPPET_HASH.test(citation.snippet_sha256));
}

// Checks only the citation shape, so a findings.json from a run under an older schema still loads.
function hasCitationShape(findings) {
  return Array.isArray(findings) && findings.every((finding) =>
    Boolean(finding) && typeof finding === "object" &&
    CITATION_FIELDS.every((field) => Array.isArray(finding[field])) &&
    (finding.refutation_checklist === undefined || Array.isArray(finding.refutation_checklist)) &&
    citationsOf(finding).every(({ citation }) => isCitation(citation)));
}

function lineStarts(bytes) {
  const starts = bytes.length === 0 ? [] : [0];
  for (let index = 0; index < bytes.length; index++) {
    if (bytes[index] === LINE_FEED && index + 1 < bytes.length) starts.push(index + 1);
  }
  return starts;
}

// The hash ignores indentation and line endings, so a re-indented or CRLF-converted line keeps it.
function snippetHash(bytes, starts, line) {
  let start = starts[line - 1];
  let end = line < starts.length ? starts[line] : bytes.length;
  while (start < end && TRIMMED_BYTES.has(bytes[start])) start++;
  while (end > start && TRIMMED_BYTES.has(bytes[end - 1])) end--;
  return crypto.createHash("sha256").update(bytes.subarray(start, end)).digest("hex");
}

function createSourceReader(targetRoot) {
  const directories = new Map();
  const files = new Map();

  function directoryNames(directory) {
    if (!directories.has(directory)) directories.set(directory, new Set(fs.readdirSync(directory)));
    return directories.get(directory);
  }

  // Walks each component with lstat so a symlink or junction cannot lead outside the target,
  // and compares names exactly so a case-insensitive file system cannot hide a wrong-case path.
  function resolve(relativePath) {
    const segments = relativePath.split("/");
    let current = targetRoot;
    for (let index = 0; index < segments.length; index++) {
      if (!directoryNames(current).has(segments[index])) return { error: "does not exist in the target" };
      current = path.join(current, segments[index]);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return { error: "passes through a symlink; cite the real path" };
      const isLeaf = index === segments.length - 1;
      if (isLeaf && !stat.isFile()) return { error: "is not a regular file" };
      if (!isLeaf && !stat.isDirectory()) return { error: "does not exist in the target" };
    }
    return { file: current };
  }

  return function read(relativePath) {
    if (files.has(relativePath)) return files.get(relativePath);
    let source;
    try {
      const resolved = resolve(relativePath);
      if (resolved.error) {
        source = resolved;
      } else {
        const bytes = readBytesWithinLimit(resolved.file);
        source = { bytes, starts: lineStarts(bytes) };
      }
    } catch (error) {
      source = { error: `cannot be read safely: ${error instanceof SafeInputError ? error.message : "read failed"}` };
    }
    files.set(relativePath, source);
    return source;
  };
}

function collectCitationErrors(findings, readSource) {
  const errors = [];
  const hashes = [];
  findings.forEach((finding, index) => {
    for (const { location: field, citation } of citationsOf(finding)) {
      if (errors.length >= LIMITS.validationErrors) break;
      const location = `$[${index}].${field}`;
      const source = readSource(citation.file);
      if (source.error) {
        errors.push(`${location}.file: ${quote(citation.file)} ${source.error}`);
        continue;
      }
      if (citation.line > source.starts.length) {
        errors.push(`${location}.line: ${citation.line} is past the end of ${quote(citation.file)} (${source.starts.length} lines)`);
        continue;
      }
      const hash = snippetHash(source.bytes, source.starts, citation.line);
      if (citation.snippet_sha256 !== undefined && citation.snippet_sha256 !== hash) {
        errors.push(`${location}.snippet_sha256: ${quote(citation.file)} line ${citation.line} changed since the hash was recorded`);
        continue;
      }
      hashes.push(`${location} ${hash}`);
    }
  });
  return { errors, hashes };
}

function run(args) {
  const printHashes = args[0] === "--print-hashes";
  const [findingsFile, targetArgument] = printHashes ? args.slice(1) : args;
  if (!findingsFile || !targetArgument) {
    console.error("Usage: node validate-citations.cjs [--print-hashes] <path-to-findings.json> <target-root>");
    return 1;
  }

  let findings;
  try {
    findings = JSON.parse(readFileWithinLimit(findingsFile));
  } catch {
    console.error("Failed to read findings JSON: input could not be opened, read, or parsed safely");
    return 1;
  }
  if (!hasCitationShape(findings)) {
    console.error("findings.json has a record without well-formed trace and evidence citations; validate-findings.cjs names it");
    return 1;
  }

  let targetRoot;
  try {
    targetRoot = fs.realpathSync(targetArgument);
    if (!fs.statSync(targetRoot).isDirectory()) throw new Error("not a directory");
  } catch {
    console.error("Failed to open target: it must be an existing directory");
    return 1;
  }

  const { errors, hashes } = collectCitationErrors(findings, createSourceReader(targetRoot));
  for (const message of errors) console.error("ERROR:", message);
  if (errors.length > 0) {
    const cap = errors.length === LIMITS.validationErrors ? `; output capped at ${LIMITS.validationErrors}` : "";
    console.error(`FAIL: ${errors.length} citation error(s)${cap}`);
    return 1;
  }
  if (printHashes) for (const line of hashes) console.log(line);
  console.log(`PASS: ${hashes.length} citations exist in the target`);
  return 0;
}

if (require.main === module) process.exit(run(process.argv.slice(2)));
