import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { test } from "node:test";
import * as library from "../src/index.js";
import { exerciseConsumer } from "../test-support/consumer.js";
import { repository, runAction, workflow } from "../test-support/repository.js";

const cli = resolve(import.meta.dirname, "../bin/already-tested.js");
const action = resolve(import.meta.dirname, "../src/action.js");

test("source CLI and Action complete a real PR-head and description-edit round trip", () => {
  exerciseConsumer({ library, cli, action });
});

test("CLI help, version, required options, and parse failures have useful exit codes and channels", (t) => {
  const repo = repository();
  t.after(repo.cleanup);
  const run = (args, cwd = repo.cwd) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
  for (const args of [[], ["--help"], ["claim", "--help"]]) {
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^Usage:/u);
    assert.equal(result.stderr, "");
  }
  const version = run(["--version"]);
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /^\d+\.\d+\.\d+\n$/u);
  for (const args of [["claim"], ["unknown"], ["--typo"], ["--workflow"],
    ["--version", "--help"], ["claim", "--version"], ["claim", "--workflow", workflow]]) {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^already-tested:/u);
  }
  const args = ["claim", "--workflow", workflow, "--check", "unit",
    "--files", "src/**", "--files", "README.md"];
  const claim = run(args);
  assert.equal(claim.status, 0, claim.stderr);
  assert.equal(claim.stdout.trimEnd(), library.createClaim({
    cwd: repo.cwd, workflow, check: "unit", files: ["README.md", "src/**"],
  }));
  assert.equal(run(args, resolve(repo.cwd, "src")).stdout, claim.stdout);
  repo.write("README.md", "Dirty");
  const dirty = run(args);
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /Commit tracked changes/u);
});

test("Action respects newline-separated filters and check identity", (t) => {
  const repo = repository();
  t.after(repo.cleanup);
  const body = library.createClaim({ cwd: repo.cwd, workflow, check: "unit", files: ["src/**"] });
  const matched = runAction({ action, repo, body, env: { INPUT_FILES: "\r\nsrc/**\r\n\n" } });
  assert.equal(matched.output, "skip=true\n", matched.stdout);
  const wrongCheck = runAction({ action, repo, body, env: {
    INPUT_FILES: "src/**", INPUT_CHECK: "other",
  } });
  assert.equal(wrongCheck.output, "skip=false\n");
  assert.equal(runAction({ action, repo, body }).output, "skip=false\n");
});

test("Action also binds the executing workflow, not just the PR head's workflow", (t) => {
  const repo = repository();
  t.after(repo.cleanup);
  const body = library.createClaim({ cwd: repo.cwd, workflow, check: "unit" });
  const ref = repo.git(["rev-parse", "HEAD"]);
  repo.write(workflow, "name: Changed on Base\n");
  repo.commit();
  const result = runAction({ action, repo, body, ref });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, "skip=false\n");
});

test("Action operational and event errors conservatively request normal CI", (t) => {
  const repo = repository();
  t.after(repo.cleanup);
  const body = library.createClaim({ cwd: repo.cwd, workflow, check: "unit" });
  const cases = [
    { GITHUB_EVENT_PATH: resolve(repo.cwd, "missing-event.json") },
    { GITHUB_EVENT_PATH: resolve(repo.cwd, "README.md") },
    { GITHUB_WORKFLOW_REF: "" },
    { GITHUB_WORKFLOW_REF: undefined },
    { GITHUB_WORKFLOW_SHA: "" },
    { GITHUB_WORKSPACE: resolve(repo.cwd, "no-such-directory") },
    { INPUT_CHECK: "" },
    { INPUT_FILES: "missing-path" },
  ];
  for (const env of cases) {
    const result = runAction({ action, repo, body, env });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, "skip=false\n");
    assert.match(result.stdout, /Running CI normally/u);
  }
  for (const ref of [null, "--help", "0".repeat(40)]) {
    const result = runAction({ action, repo, body, ref });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, "skip=false\n");
    assert.match(result.stdout, /Running CI normally/u);
  }
  for (const event of ["push", "workflow_dispatch", "pull_request_target"]) {
    const result = runAction({ action, repo, body, env: {
      GITHUB_EVENT_NAME: event, GITHUB_EVENT_PATH: "does-not-exist",
    } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, "skip=false\n");
  }
  const withoutFilters = runAction({ action, repo, body, env: { INPUT_FILES: undefined } });
  assert.equal(withoutFilters.status, 0, withoutFilters.stderr);
  assert.equal(withoutFilters.output, "skip=true\n");
});
