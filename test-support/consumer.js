import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { repository, runAction, workflow } from "./repository.js";

export function exerciseConsumer({ library, cli, action }) {
  const repo = repository();
  try {
    repo.git(["switch", "-qc", "feature"]);
    repo.write("src/feature.js", "export const feature = true;\n");
    repo.commit();
    const generated = spawnSync(process.execPath, [
      cli, "claim", "--workflow", workflow, "--check", "unit",
    ], { cwd: repo.cwd, encoding: "utf8" });
    assert.ifError(generated.error);
    assert.equal(generated.status, 0, generated.stderr);
    const claim = generated.stdout.trimEnd();
    const canonical = library.createClaim({ cwd: repo.cwd, workflow, check: "unit" });
    assert.match(claim, /^<details>\n<summary>unit - passed<\/summary>\n\n/u);
    assert.ok(claim.endsWith("\n</details>"));
    assert.ok(claim.includes("` " + canonical));
    assert.ok(!claim.includes("**Ran:**"));
    assert.ok(!claim.includes("**Environment:**"));
    const detailed = spawnSync(process.execPath, [
      cli, "claim", "--workflow", workflow, "--check", "unit",
      "--summary", "Local <tests> & checks", "--command", "npm test",
      "--environment", "Node.js on the local host",
    ], { cwd: repo.cwd, encoding: "utf8" });
    assert.equal(detailed.status, 0, detailed.stderr);
    assert.match(detailed.stdout, /<summary>Local &lt;tests&gt; &amp; checks<\/summary>/u);
    assert.ok(detailed.stdout.includes("- **Ran:** ` npm test `"));
    assert.equal(library.verifyClaim({ cwd: repo.cwd, workflow, check: "unit", body: detailed.stdout }), true);
    const raw = spawnSync(process.execPath, [
      cli, "claim", "--workflow", workflow, "--check", "unit", "--raw",
    ], { cwd: repo.cwd, encoding: "utf8" });
    assert.equal(raw.status, 0, raw.stderr);
    assert.equal(raw.stdout, `${canonical}\n`);
    assert.equal(library.verifyClaim({ cwd: repo.cwd, workflow, check: "unit", body: claim }), true);
    const ref = repo.git(["rev-parse", "HEAD"]);
    repo.git(["switch", "-q", "master"]);
    repo.write("src/add.js", "export const add = () => 0;\n");
    repo.commit();
    repo.git(["merge", "--no-ff", "--quiet", "-m", "Merge fixture", "feature"]);
    const matched = runAction({ action, repo, body: `Tests passed.\n\n${claim}`, ref });
    assert.equal(matched.status, 0, matched.stderr);
    assert.equal(matched.output, "skip=true\n", matched.stdout);
    const changed = runAction({ action, repo, body: claim });
    assert.equal(changed.status, 0, changed.stderr);
    assert.equal(changed.output, "skip=false\n");
    const edited = runAction({ action, repo, body: "Claim removed.", ref });
    assert.equal(edited.status, 0, edited.stderr);
    assert.equal(edited.output, "skip=false\n");
    const pushed = runAction({
      action, repo, body: claim, ref, env: { GITHUB_EVENT_NAME: "push" },
    });
    assert.equal(pushed.status, 0, pushed.stderr);
    assert.equal(pushed.output, "skip=false\n");
  } finally {
    repo.cleanup();
  }
}
