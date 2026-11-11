import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { test } from "node:test";
import { createClaim, verifyClaim } from "../src/index.js";
import { repository, workflow } from "../test-support/repository.js";

function fixture(t, options) {
  const repo = repository(options);
  t.after(repo.cleanup);
  return {
    ...repo,
    claim: (extra = {}) => createClaim({ cwd: repo.cwd, workflow, check: "unit", ...extra }),
    verify: (body, extra = {}) => verifyClaim({ cwd: repo.cwd, workflow, check: "unit", body, ...extra }),
  };
}

test("claims are deterministic and match among multiple claims in a PR description", (t) => {
  const repo = fixture(t);
  const claim = repo.claim();
  assert.equal(claim, repo.claim());
  assert.match(claim, /^<!-- already-tested:v1 \{.*"hash":"sha256:[0-9a-f]{64}"\} -->$/u);
  assert.equal(repo.verify(`A description.\n${repo.claim({ check: "lint" })}\n${claim}\n`), true);
  assert.equal(repo.verify(claim, { check: "lint" }), false);
  assert.equal(repo.verify(claim, { workflow: ".github/workflows/other.yml" }), false);
});

test("content, paths, additions, deletions, workflow edits, and executable modes invalidate claims", async (t) => {
  const changes = {
    contents: (repo) => repo.write("src/add.js", "changed\n"),
    additions: (repo) => repo.write("src/new.js", "new\n"),
    deletions: (repo) => unlinkSync(join(repo.cwd, "src/add.js")),
    renames: (repo) => repo.git(["mv", "src/add.js", "src/renamed.js"]),
    workflow: (repo) => repo.write(workflow, "name: Changed\n"),
  };
  for (const [name, change] of Object.entries(changes)) {
    await t.test(name, (t) => {
      const repo = fixture(t);
      const claim = repo.claim();
      change(repo);
      repo.commit();
      assert.equal(repo.verify(claim), false);
    });
  }
  await t.test("executable mode", (t) => {
    const repo = fixture(t);
    const claim = repo.claim();
    repo.git(["update-index", "--chmod=+x", "src/add.js"]);
    repo.git(["commit", "-qm", "Executable"]);
    assert.equal(repo.verify(claim), false);
  });
});

test("filters use Git pathspecs, deduplicate deterministically, and bind the selection policy", (t) => {
  const repo = fixture(t);
  const files = ["src/**", "README.md", "src/**"];
  const claim = repo.claim({ files });
  assert.equal(repo.claim({ files: ["README.md", "src/**"] }), claim);
  assert.equal(repo.verify(claim, { files: ["src/**", "README.md"] }), true);
  assert.equal(repo.verify(claim), false);
  assert.equal(repo.verify(claim, { files: ["src/*", "README.md"] }), false);
  const narrow = repo.claim({ files: ["src/**"] });
  repo.write("README.md", "Unselected change\n");
  repo.commit();
  assert.equal(repo.verify(narrow, { files: ["src/**"] }), true);
  assert.equal(repo.verify(claim, { files }), false);
  repo.write(workflow, "name: New Workflow\n");
  repo.commit();
  assert.equal(repo.verify(narrow, { files: ["src/**"] }), false);
});

test("hashing uses committed bytes, unambiguous framing, and Unicode/newline file names", (t) => {
  const repo = fixture(t);
  repo.write("src/a", "bc");
  repo.write("src/b", "d");
  repo.write(process.platform === "win32" ? "src/caf\u00e9" : "src/caf\u00e9\nfile", Buffer.from([0, 10, 255, 13]));
  repo.commit();
  const claim = repo.claim();
  assert.equal(repo.verify(claim), true);
  repo.write("src/a", "b");
  repo.write("src/b", "cd");
  repo.commit();
  assert.equal(repo.verify(claim), false);
  const current = repo.claim();
  repo.git(["config", "core.autocrlf", "true"]);
  assert.equal(repo.verify(current), true);
});

test("Git object format and unrelated index/checkout state do not change the snapshot", (t) => {
  const sha1 = fixture(t);
  const sha256 = fixture(t, { objectFormat: "sha256" });
  assert.equal(sha1.claim(), sha256.claim());
  const claim = sha1.claim();
  const ref = sha1.git(["rev-parse", "HEAD"]);
  sha1.write("src/add.js", "worktree changes");
  sha1.git(["add", "src/add.js"]);
  const index = sha1.git(["ls-files", "--stage"]);
  assert.equal(sha1.verify(claim, { ref }), true);
  assert.equal(sha1.git(["ls-files", "--stage"]), index);
  sha1.write("src/new.js", "untracked");
  assert.equal(sha1.verify(claim, { ref }), true);
  assert.throws(() => sha1.claim(), /Commit tracked changes/u);
});

test("staged and unstaged tracked changes prevent local claims", (t) => {
  const repo = fixture(t);
  repo.write("src/add.js", "changed");
  assert.throws(() => repo.claim(), /Commit tracked changes/u);
  repo.git(["add", "src/add.js"]);
  assert.throws(() => repo.claim(), /Commit tracked changes/u);
  repo.commit();
  assert.equal(repo.verify(repo.claim()), true);
});

test("missing, malformed, stale, and unknown-version claims never match", (t) => {
  const repo = fixture(t);
  const claim = repo.claim();
  for (const body of [undefined, null, "", "Tests passed", "<!-- already-tested:v1 nope -->",
    claim.replace(":v1 ", ":v2 "), claim.replace("sha256:", "sha512:")]) {
    assert.equal(repo.verify(body), false);
  }
});

test("invalid workflows, identifiers, pathspecs, and refs cannot produce a skip", (t) => {
  const repo = fixture(t);
  for (const workflow of [undefined, "", "../test.yml", "/test.yml", ".github/workflows/a/b.yml"]) {
    assert.throws(() => repo.claim({ workflow }), /workflow must/u);
  }
  for (const check of [undefined, "", "two words", "a".repeat(129), "$(touch bad)"]) {
    assert.throws(() => repo.claim({ check }), /check must/u);
  }
  for (const files of ["src/**", [""], [null], ["a\0b"], [" :(attr:generated)**"]]) {
    assert.throws(() => repo.claim({ files }), /patterns|supported/u);
  }
  assert.throws(() => repo.claim({ files: ["no-such-file"] }), /matched no tracked files/u);
  assert.throws(() => repo.claim({ files: [":(nonsense)**"] }), /pathspec magic/u);
  assert.throws(() => repo.claim({ workflow: ".github/workflows/missing.yml" }), /not tracked/u);
  assert.throws(() => repo.verify(repo.claim(), { ref: "--help" }), /ref and workflowRef must/u);
  assert.throws(() => repo.verify(repo.claim(), { ref: "0".repeat(40) }), /Command failed/u);
});

test("symlinks and submodules are rejected unless excluded from the selection", async (t) => {
  for (const mode of ["120000", "160000"]) {
    await t.test(mode, (t) => {
      const repo = fixture(t);
      const claim = repo.claim({ files: ["src/**"] });
      const oid = mode === "160000"
        ? repo.git(["rev-parse", "HEAD"])
        : repo.git(["hash-object", "-w", "--stdin"], { input: "README.md" });
      repo.git(["update-index", "--add", "--cacheinfo", `${mode},${oid},unsupported`]);
      repo.git(["commit", "-qm", "Unsupported mode"]);
      assert.equal(repo.verify(claim, { files: ["src/**"] }), true);
      assert.throws(() => repo.verify(claim), /Unsupported file mode/u);
    });
  }
});

test("missing committed blob objects cause verification errors, not a match", (t) => {
  const repo = fixture(t);
  const claim = repo.claim();
  const blob = repo.git(["rev-parse", "HEAD:src/add.js"]);
  unlinkSync(join(repo.cwd, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
  assert.throws(() => repo.verify(claim), /Cannot read committed file/u);
});

test("non-UTF-8 file paths are rejected rather than hashed with replacement characters", {
  skip: process.platform === "win32",
}, (t) => {
  const repo = fixture(t);
  const claim = repo.claim();
  const blob = repo.git(["rev-parse", "HEAD:src/add.js"]);
  const tree = repo.git(["mktree", "-z"], {
    input: Buffer.concat([
      Buffer.from(repo.git(["ls-tree", "-z", "HEAD"])),
      Buffer.from(`100644 blob ${blob}\t`),
      Buffer.from([255, 0]),
    ]),
  });
  const ref = repo.git(["commit-tree", tree, "-p", "HEAD", "-m", "Invalid path"]);
  assert.throws(() => repo.verify(claim, { ref }), /valid UTF-8/u);
});
