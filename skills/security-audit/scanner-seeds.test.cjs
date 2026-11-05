const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const seedsPath = path.join(__dirname, "scanner-seeds.cjs");
const gatePath = path.join(__dirname, "validate-artifact-content.cjs");
const CLI_TIMEOUT_MS = 5000;

// Assembled at run time so no secret-shaped literal sits in the repository.
const FAKE_SECRET = ["AKIA", "Z".repeat(16)].join("");
const FAKE_AUTHOR_EMAIL = "maria.silva@contribuinte.com.br";

const REPORTS = {
  gitleaks: [{
    RuleID: "aws-access-token", File: "src/config.ts", StartLine: 12, Commit: "a".repeat(40),
    Secret: FAKE_SECRET, Match: `key = ${FAKE_SECRET}`, Author: "Maria", Email: FAKE_AUTHOR_EMAIL,
    Message: `add ${FAKE_SECRET}`, Link: "https://git.corp.com.br/x", Fingerprint: `${"a".repeat(40)}:src/config.ts:aws-access-token:12`,
  }],
  semgrep: {
    results: [{
      check_id: "rules.raw-query", path: "/scan/copy/src/db.ts", start: { line: 7, col: 3 }, end: { line: 7, col: 40 },
      extra: { lines: `db.query("${FAKE_SECRET}")`, metavars: { $X: { abstract_content: FAKE_SECRET } }, message: FAKE_AUTHOR_EMAIL },
    }],
    paths: { scanned: ["src/db.ts"] },
  },
  "osv-scanner": {
    results: [{
      source: { path: "/scan/copy/package-lock.json", type: "lockfile" },
      packages: [{
        package: { name: "@acme/parser", version: "1.2.3", ecosystem: "npm" },
        vulnerabilities: [{ id: "GHSA-aaaa-bbbb-cccc", details: FAKE_AUTHOR_EMAIL }],
        groups: [{ ids: ["GHSA-aaaa-bbbb-cccc", "CVE-2026-0001"], aliases: [], max_severity: "9.8" }],
      }],
    }],
  },
  zizmor: [{
    ident: "template-injection", desc: "expansion", url: "https://docs.zizmor.sh/audits/", ignored: false,
    locations: [
      { symbolic: { key: { Local: { verbatim_path: "/scan/copy/.github/workflows/ci.yml" } }, kind: "Related" }, concrete: { location: { start_point: { row: 1, column: 0 } }, feature: "" } },
      { symbolic: { key: { Local: { verbatim_path: "/scan/copy/.github/workflows/ci.yml" } }, kind: "Primary" }, concrete: { location: { start_point: { row: 41, column: 8 } }, feature: `run: echo ${FAKE_SECRET}` } },
    ],
  }],
};

const EXPECTED_SEEDS = {
  gitleaks: [{ tool: "gitleaks", rule_id: "aws-access-token", path: "src/config.ts", line: 12, commit: "a".repeat(40) }],
  semgrep: [{ tool: "semgrep", rule_id: "rules.raw-query", path: "src/db.ts", line: 7 }],
  "osv-scanner": [{ tool: "osv-scanner", rule_id: "GHSA-aaaa-bbbb-cccc", path: "package-lock.json", package: "@acme/parser@1.2.3", max_severity: "9.8" }],
  zizmor: [{ tool: "zizmor", rule_id: "template-injection", path: ".github/workflows/ci.yml", line: 42 }],
};

function withReport(report, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-seeds-"));
  try {
    const file = path.join(directory, "raw.json");
    fs.writeFileSync(file, typeof report === "string" ? report : JSON.stringify(report));
    return callback(file, directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function runSeeds(args) {
  return spawnSync(process.execPath, [seedsPath, ...args], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
}

for (const tool of Object.keys(REPORTS)) {
  test(`projects a ${tool} report to seeds that carry nothing the gate denies`, () => {
    withReport(REPORTS[tool], (file, directory) => {
      const result = runSeeds(["--tool", tool, "--root", "/scan/copy", file]);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout).seeds, EXPECTED_SEEDS[tool]);
      assert.equal(result.stdout.includes(FAKE_SECRET), false);
      assert.equal(result.stdout.includes(FAKE_AUTHOR_EMAIL), false);

      const seedsFile = path.join(directory, "seeds.json");
      fs.writeFileSync(seedsFile, result.stdout);
      const gate = spawnSync(process.execPath, [gatePath, seedsFile], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
      assert.equal(gate.status, 0, gate.stderr);
    });
  });
}

test("drops duplicate seeds and orders the rest deterministically", () => {
  const second = { ...REPORTS.gitleaks[0], File: "a.ts" };
  withReport([REPORTS.gitleaks[0], second, REPORTS.gitleaks[0]], (file) => {
    const result = runSeeds(["--tool", "gitleaks", file]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).seeds.map((seed) => seed.path), ["a.ts", "src/config.ts"]);
  });
});

test("refuses a report path outside the scanned directory without echoing it", () => {
  withReport(REPORTS.semgrep, (file) => {
    const result = runSeeds(["--tool", "semgrep", file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /results\[0\]\.path: path is outside the scanned directory; pass --root/);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes("/scan/copy"), false);
  });
});

test("refuses a rule id that is not an identifier without echoing it", () => {
  withReport([{ ...REPORTS.gitleaks[0], RuleID: `bad rule ${FAKE_SECRET}` }], (file) => {
    const result = runSeeds(["--tool", "gitleaks", file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /report\[0\]\.RuleID: unexpected value/);
    assert.equal(`${result.stdout}${result.stderr}`.includes(FAKE_SECRET), false);
  });
});

test("fails on a report of the wrong shape or malformed JSON", () => {
  withReport({ findings: [] }, (file) => {
    const result = runSeeds(["--tool", "semgrep", file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /results: expected an array/);
  });
  withReport([null], (file) => {
    const result = runSeeds(["--tool", "gitleaks", file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unexpected shape/);
  });
  withReport("{", (file) => {
    const result = runSeeds(["--tool", "semgrep", file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /could not be read or parsed safely/);
  });
});

test("prints usage for an unknown tool or a missing report", () => {
  for (const args of [["--tool", "trufflehog", "raw.json"], ["--tool", "constructor", "raw.json"], ["--tool", "gitleaks"], ["raw.json"]]) {
    const result = runSeeds(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^Usage:/);
  }
});
