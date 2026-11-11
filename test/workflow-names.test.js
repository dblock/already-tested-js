import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { test } from "node:test";
import { checkWorkflowNames } from "../scripts/check-workflow-names.js";

test("accepts title-case display names, expressions, and missing optional names", () => {
  assert.deepEqual(checkWorkflowNames(`
name: Test
jobs:
  lower-case-id:
    name: Test on Node.js \${{ matrix.entry.node }}
    steps:
      - name: Install with npm
        run: npm ci
      - name: Run \`already-tested\`
        run: echo ok
      - uses: actions/checkout@v7.0.1
`), []);
  assert.deepEqual(checkWorkflowNames(""), []);
});

test("reports workflow, job, and step display names, not arbitrary name fields", () => {
  const errors = checkWorkflowNames(`
name: run tests
jobs:
  unit-tests:
    name: test everything
    steps:
      - name: install dependencies
        with:
          name: leave this alone
  unnamed:
    steps:
      - run: echo ok
`);
  assert.deepEqual(errors.map((error) => error.path), [
    "name", "jobs.unit-tests.name", "jobs.unit-tests.steps[0].name",
  ]);
});

test("rejects empty and non-string display names", () => {
  for (const value of ['""', '"   "', "null", "42", "false"]) {
    const [error] = checkWorkflowNames(`name: ${value}`);
    assert.match(error.message, /nonempty strings/u);
  }
});

test("rejects malformed YAML and duplicate mapping keys", () => {
  assert.throws(() => checkWorkflowNames("jobs: ["), /flow sequence/iu);
  assert.throws(() => checkWorkflowNames("name: Test\nname: Lint\n"), /unique/u);
});

test("CLI checks YAML files and reports names and parse errors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "already-tested-workflows-"));
  const script = resolve(import.meta.dirname, "../scripts/check-workflow-names.js");
  try {
    await writeFile(join(directory, "test.yml"), "name: Test\n");
    await writeFile(join(directory, "ignored.txt"), "invalid: [");
    const valid = spawnSync(process.execPath, [script, directory], { encoding: "utf8" });
    assert.ifError(valid.error);
    assert.equal(valid.status, 0, valid.stderr);
    await writeFile(join(directory, "lint.yaml"), "name: run lint\n");
    await writeFile(join(directory, "broken.yml"), "name: [");
    const invalid = spawnSync(process.execPath, [script, directory], { encoding: "utf8" });
    assert.ifError(invalid.error);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /lint\.yaml: name: Use title case/u);
    assert.match(invalid.stderr, /broken\.yml:/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test.todo("Generate and verify content-matched PR claims in the implementation PR");
