const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const validatorPath = path.join(__dirname, "validate-citations.cjs");
const CLI_TIMEOUT_MS = 5000;
const HANDLER_SOURCE = "export function handle(id) {\n  return store.update(id);\n}\n";

function rejectedCiting(file, line) {
  return {
    verdict: "rejected",
    fingerprint: "src-handler-update",
    title: "Unchecked update",
    description: "The candidate claimed the update skips the ownership check.",
    claimed_root_cause: "handle was claimed to update without an ownership check.",
    trace: [{ kind: "sink", file, line, scope: "handle", description: "The update runs." }],
    evidence: [{ file, line, description: "The update call." }],
    reason: "The router checks ownership before handle runs.",
  };
}

function withTarget(files, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "validate-citations-"));
  const target = path.join(root, "target");
  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      fs.mkdirSync(path.join(target, path.dirname(relativePath)), { recursive: true });
      fs.writeFileSync(path.join(target, relativePath), contents);
    }
    return callback({ root, target });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function runCli({ root, target }, findings, flags = []) {
  const findingsPath = path.join(root, "findings.json");
  fs.writeFileSync(findingsPath, JSON.stringify(findings));
  const result = spawnSync(process.execPath, [validatorPath, ...flags, findingsPath, target], {
    encoding: "utf8",
    timeout: CLI_TIMEOUT_MS,
  });
  return { ...result, output: `${result.stdout}${result.stderr}` };
}

test("passes existing citations and verifies the printed hash after a reindent", () => {
  withTarget({ "src/handler.ts": HANDLER_SOURCE }, (dirs) => {
    const finding = rejectedCiting("src/handler.ts", 2);
    const printed = runCli(dirs, [finding], ["--print-hashes"]);
    assert.equal(printed.status, 0, printed.output);
    assert.match(printed.stdout, /PASS: 2 citations exist in the target/);
    const hash = printed.stdout.match(/^\$\[0\]\.trace\[0\] ([0-9a-f]{64})$/m)[1];

    finding.trace[0].snippet_sha256 = hash;
    finding.evidence[0].snippet_sha256 = hash;
    fs.writeFileSync(path.join(dirs.target, "src/handler.ts"), HANDLER_SOURCE.replace("\n  return", "\r\n\treturn"));
    const verified = runCli(dirs, [finding]);
    assert.equal(verified.status, 0, verified.output);
  });
});

test("fails a recorded hash once the cited line changes", () => {
  withTarget({ "src/handler.ts": HANDLER_SOURCE }, (dirs) => {
    const finding = rejectedCiting("src/handler.ts", 2);
    const hash = runCli(dirs, [finding], ["--print-hashes"]).stdout.match(/ ([0-9a-f]{64})$/m)[1];
    finding.trace[0].snippet_sha256 = hash;
    fs.writeFileSync(path.join(dirs.target, "src/handler.ts"), HANDLER_SOURCE.replace("update(id)", "update(owner, id)"));

    const result = runCli(dirs, [finding]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, /\$\[0\]\.trace\[0\]\.snippet_sha256: "src\/handler\.ts" line 2 changed/);
  });
});

test("fails a missing file and a path that differs only in case", () => {
  withTarget({ "src/handler.ts": HANDLER_SOURCE }, (dirs) => {
    for (const file of ["src/missing.ts", "src/Handler.ts", "src/handler.ts/inner.ts"]) {
      const result = runCli(dirs, [rejectedCiting(file, 1)]);
      assert.equal(result.status, 1, result.output);
      assert.match(result.stderr, /\$\[0\]\.trace\[0\]\.file: .* (does not exist in the target|is not a regular file)/);
    }
  });
});

test("fails a line past the end without counting the trailing newline as a line", () => {
  withTarget({ "src/handler.ts": HANDLER_SOURCE }, (dirs) => {
    assert.equal(runCli(dirs, [rejectedCiting("src/handler.ts", 3)]).status, 0);
    const result = runCli(dirs, [rejectedCiting("src/handler.ts", 4)]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, /line: 4 is past the end of "src\/handler\.ts" \(3 lines\)/);
  });
});

test("fails a citation through a symlink that leaves the target", (t) => {
  withTarget({ "src/handler.ts": HANDLER_SOURCE }, (dirs) => {
    const outside = path.join(dirs.root, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "secret.ts"), "outside the target\n");
    try {
      fs.symlinkSync(outside, path.join(dirs.target, "linked"), "junction");
    } catch (error) {
      if (error.code !== "EPERM") throw error;
      t.skip("creating a link needs Developer Mode or SeCreateSymbolicLinkPrivilege");
      return;
    }
    const result = runCli(dirs, [rejectedCiting("linked/secret.ts", 1)]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, /passes through a symlink/);
  });
});

test("refuses findings that fail validate-findings without an exception trace", () => {
  withTarget({ "src/handler.ts": HANDLER_SOURCE }, (dirs) => {
    const finding = rejectedCiting("src/handler.ts", 1);
    delete finding.trace;
    const result = runCli(dirs, [finding]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, /does not pass validate-findings\.cjs/);
    assert.doesNotMatch(result.output, /TypeError|at validate-citations/);
  });
});
