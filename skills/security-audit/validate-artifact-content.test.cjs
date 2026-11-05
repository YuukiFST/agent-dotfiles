const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const validatorPath = path.join(__dirname, "validate-artifact-content.cjs");
const CLI_TIMEOUT_MS = 5000;

// Assembled at run time so no secret-shaped literal sits in the repository.
const SECRET_SAMPLES = {
  "private-key": ["-----BEGIN RSA ", "PRIVATE KEY-----"].join(""),
  "aws-access-key": ["AKIA", "Z".repeat(16)].join(""),
  "stripe-live-key": ["sk_", "live_", "x".repeat(24)].join(""),
  "github-token": ["gh", "p_", "a".repeat(36)].join(""),
  "slack-token": ["xox", "b-", "1".repeat(12)].join(""),
  "anthropic-api-key": ["sk-", "ant-api03-", "a".repeat(24)].join(""),
  "openai-api-key": ["sk-", "proj-", "a".repeat(24)].join(""),
  "google-api-key": ["AI", "za", "a".repeat(35)].join(""),
  "sendgrid-api-key": ["SG", ".", "a".repeat(66)].join(""),
  "npm-token": ["npm", "_", "a".repeat(36)].join(""),
  "gitlab-token": ["gl", "pat-", "a".repeat(20)].join(""),
  "supabase-token": ["sb", "p_", "a".repeat(40)].join(""),
  "connection-string": ["Server=db.test;Database=iptu;User Id=app;", "Password=", "hunter2x"].join(""),
  "assigned-secret": ["client_secret=", "aB3dE6fG9hJ2kL5m", "N8pQ1"].join(""),
  jwt: ["eyJ", "hbGciOi", ".eyJzdWIi", "OiIxIn0", ".c2lnbmF0dXJl"].join(""),
  "url-credentials": ["postgres://app", ":hunter2", "@db.internal.corp/app"].join(""),
  cpf: "529.982.247-25",
  cnpj: "11.222.333/0001-81",
  email: "maria.silva@contribuinte.com.br",
  host: "https://api.prod.corp.com.br/v1",
};

function withArtifacts(files, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "validate-artifact-content-"));
  try {
    for (const [name, contents] of Object.entries(files)) {
      fs.writeFileSync(path.join(directory, name), typeof contents === "string" ? contents : JSON.stringify(contents));
    }
    return callback((name) => path.join(directory, name));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function runCli(args) {
  const result = spawnSync(process.execPath, [validatorPath, ...args], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  return { ...result, output: `${result.stdout}${result.stderr}` };
}

test("passes loopback, reserved names, and numbers that fail their check digits", () => {
  const findings = [{
    title: "Server binds 0.0.0.0 and serves http://localhost:3000/api",
    execution: {
      payloads: ["qa@example.com", "http://app.test/login", "http://[::1]:8080/", "127.0.0.1"],
      instructions: ["Send CPF 529.982.247-26 and CNPJ 12.ABC.345/01DE-36 to the dummy tenant."],
      observed_result: "Version 1.2.3.4.5 with lodash@4.17.21 returned the record of user 192.0.2.10.",
    },
  }];
  withArtifacts({ "findings.json": findings }, (file) => {
    const result = runCli([file("findings.json")]);
    assert.equal(result.status, 0, result.output);
    assert.match(result.stdout, /PASS: 1 artifact\(s\) carry no denied value/);
  });
});

test("fails every built-in secret and personal-data type without echoing the value", () => {
  const findings = [{ execution: { payloads: Object.values(SECRET_SAMPLES), observed_result: "CNPJ 12.ABC.345/01DE-35" } }];
  withArtifacts({ "findings.json": findings }, (file) => {
    const result = runCli([file("findings.json")]);
    assert.equal(result.status, 1, result.output);
    Object.keys(SECRET_SAMPLES).forEach((name, index) => {
      assert.match(result.stderr, new RegExp(`"findings\\.json" \\$\\[0\\]\\.execution\\.payloads\\[${index}\\]: ${name}\\n`));
    });
    assert.match(result.stderr, /\$\[0\]\.execution\.observed_result: cnpj\n/);
    for (const value of [...Object.values(SECRET_SAMPLES), "12.ABC.345/01DE-35", "hunter2", "maria.silva"]) {
      assert.equal(result.output.includes(value), false, `output echoes ${value}`);
    }
  });
});

test("fails each credential variant the built-in detectors name", () => {
  const variants = {
    "aws-access-key": ["AS" + "IA", "AB" + "IA", "AC" + "CA", "A3" + "TX"].map((prefix) => [prefix, "Z".repeat(16)].join("")),
    "stripe-live-key": [["rk_", "prod_", "x".repeat(24)].join("")],
    "anthropic-api-key": [["sk-", "ant-admin01-", "a".repeat(24)].join("")],
    "openai-api-key": [["sk-", "svcacct-", "a".repeat(24)].join(""), ["sk-", "a".repeat(20), "T3Blbk", "FJ", "a".repeat(20)].join("")],
    "supabase-token": [["sb_", "secret_", "a".repeat(32)].join("")],
    "connection-string": [
      ["sqlserver://db.test;database=iptu;", "password=", "hunter2x"].join(""),
      ["Data Source=db.test;Initial Catalog=iptu;UID=app;", "PWD=", '"hunter2x"'].join(""),
      ["Server=db.test;", "Password=", "{hunter;2x}"].join(""),
    ],
    "assigned-secret": [['"API_KEY": "', "aB3dE6fG9hJ2kL5mN8pQ1", '"'].join(""), ["db_password := ", "aB3dE6fG9hJ2kL5mN8pQ1"].join("")],
  };
  for (const [name, values] of Object.entries(variants)) {
    withArtifacts({ "findings.json": [{ evidence: values }] }, (file) => {
      const result = runCli([file("findings.json")]);
      assert.equal(result.status, 1, `${name}: ${result.output}`);
      values.forEach((value, index) => {
        assert.ok(result.stderr.includes(`$[0].evidence[${index}]: ${name}\n`), result.stderr);
        assert.equal(result.output.includes(value), false, `output echoes a ${name} value`);
      });
    });
  }
});

test("passes placeholders, code references, and permitted hash prefixes", () => {
  const evidence = [
    "Server=db.test;Database=iptu;User Id=app;Password=${DB_PASSWORD};",
    "Server=db.test;Password=%DB_PASSWORD%;",
    "Server=db.test;Password=$DB_PASSWORD;",
    "Server=db.test;Password={{ db_password }};",
    "Server=db.test;Password=<password>;",
    "Server=db.test;Password=***;",
    'Server=db.test;Password="";',
    "Set password=hunter2x on the dummy user; the form rejects it.",
    "const token = process.env.API_TOKEN_2_VALUE;",
    "password = correcthorsebatterystaple",
    "secret_sha256: a1b2c3d4e5f6",
    "token=aaaaaaaaaaaaaaaaaaaa1",
    "The publishable key sb_publishable_abcdefghijklmnop ships to browsers.",
    ["sk_", "test_", "a".repeat(24)].join(""),
  ];
  withArtifacts({ "findings.json": [{ evidence }] }, (file) => {
    const result = runCli([file("findings.json")]);
    assert.equal(result.status, 0, result.output);
  });
});

test("an allow rule passes a dummy connection-string password by value", () => {
  const rules = { allow: [{ detector: "connection-string", match: "dummy-pass" }] };
  const findings = [{ evidence: ["Server=db.test;Password=dummy-pass;", "Server=db.test;Password=other-pass;"] }];
  withArtifacts({ "findings.json": findings, "rules.json": rules }, (file) => {
    const result = runCli(["--rules", file("rules.json"), file("findings.json")]);
    assert.equal(result.status, 1, result.output);
    assert.deepEqual(result.stderr.match(/^ERROR: .*$/gm), ['ERROR: "findings.json" $[0].evidence[1]: connection-string']);
  });
});

test("an allow rule passes only its detector, value, and field", () => {
  const rules = {
    allow: [
      { detector: "email", match: "^qa@corp\\.com\\.br$", fields: ["execution.payloads"] },
      { detector: "host", cidr: "10.20.0.0/16" },
    ],
  };
  const findings = [{
    description: "Reached 10.20.5.6 as qa@corp.com.br.",
    execution: { payloads: ["qa@corp.com.br", "http://10.20.5.6/admin", "http://10.21.0.1/"] },
  }];
  withArtifacts({ "findings.json": findings, "rules.json": rules }, (file) => {
    const result = runCli(["--rules", file("rules.json"), file("findings.json")]);
    assert.equal(result.status, 1, result.output);
    assert.deepEqual(result.stderr.match(/^ERROR: .*$/gm), [
      'ERROR: "findings.json" $[0].description: email',
      'ERROR: "findings.json" $[0].execution.payloads[2]: host',
    ]);
  });
});

test("regression: an allow pattern matches whole values, not a fragment", () => {
  const rules = { allow: [{ detector: "email", match: "acme" }, { detector: "host", match: "api\\.acme-dummy\\.dev" }] };
  const findings = [{ execution: { payloads: ["ceo@acme-corp.com.br", "https://api.acme-dummy.dev/v1", "https://api.acme-dummy.dev.evil.com.br/"] } }];
  withArtifacts({ "findings.json": findings, "rules.json": rules }, (file) => {
    const result = runCli(["--rules", file("rules.json"), file("findings.json")]);
    assert.equal(result.status, 1, result.output);
    assert.deepEqual(result.stderr.match(/^ERROR: .*$/gm), [
      'ERROR: "findings.json" $[0].execution.payloads[0]: email',
      'ERROR: "findings.json" $[0].execution.payloads[2]: host',
    ]);
  });
});

test("regression: public weakness catalogs a remediation cites pass the host detector", () => {
  const report = [
    "See https://cwe.mitre.org/data/definitions/79.html, https://cheatsheetseries.owasp.org/ and https://nvd.nist.gov/vuln.",
    "The legacy record is https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-44228.",
    "The worker calls https://cwe.mitre.org.prod.corp.com.br/ on start.",
  ].join("\n");
  withArtifacts({ "REPORT.md": report }, (file) => {
    const result = runCli([file("REPORT.md")]);
    assert.equal(result.status, 1, result.output);
    assert.deepEqual(result.stderr.match(/^ERROR: .*$/gm), ['ERROR: "REPORT.md" line 3: host']);
  });
});

test("regression: an allow rule names the dummy host at a sentence end and the dummy user:password pair", () => {
  const rules = { allow: [{ detector: "host", match: "api\\.acme-dummy\\.dev" }, { detector: "url-credentials", match: "qa:dummy-pw" }] };
  const report = ["Call https://api.acme-dummy.dev.", `Connect with postgres://${"qa:dummy-pw"}@api.acme-dummy.dev/app`].join("\n");
  withArtifacts({ "REPORT.md": report, "rules.json": rules }, (file) => {
    const result = runCli(["--rules", file("rules.json"), file("REPORT.md")]);
    assert.equal(result.status, 0, result.output);
  });
});

test("a deny rule adds a project-specific detector", () => {
  const rules = { deny: [{ name: "sb360-token", match: "SB360-[A-Z0-9]{16}" }] };
  withArtifacts({ "findings.json": [{ title: `Token ${"SB360-"}${"A1".repeat(8)} leaked` }], "rules.json": rules }, (file) => {
    const result = runCli(["--rules", file("rules.json"), file("findings.json")]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, /\$\[0\]\.title: sb360-token\n/);
  });
});

test("scans a Markdown report line by line", () => {
  withArtifacts({ "REPORT.md": `# Report\n\nThe seed holds CPF ${SECRET_SAMPLES.cpf}.\n` }, (file) => {
    const result = runCli([file("REPORT.md")]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stderr, /"REPORT\.md" line 3: cpf\n/);
  });
});

test("refuses a malformed rules file without an exception trace", () => {
  const cases = [
    [{ allow: [{ detector: "email", match: "x", note: "extra" }] }, /rules\.allow\[0\]: unexpected field "note"/],
    [{ allow: [{ detector: "host" }] }, /needs exactly one of "match" or "cidr"/],
    [{ deny: [{ name: "cpf", match: "x" }] }, /expected a new lowercase detector name/],
    [{ allow: {} }, /allow and deny must be arrays/],
  ];
  for (const [rules, message] of cases) {
    withArtifacts({ "findings.json": [], "rules.json": rules }, (file) => {
      const result = runCli(["--rules", file("rules.json"), file("findings.json")]);
      assert.equal(result.status, 1, result.output);
      assert.match(result.stderr, message);
      assert.doesNotMatch(result.output, /TypeError|at validate-artifact-content/);
    });
  }
});
