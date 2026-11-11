import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";

export const workflow = ".github/workflows/test.yml";

export function repository({ objectFormat = "sha1" } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "already-tested-repository-"));
  function git(args, options = {}) {
    return execFileSync("git", args, { cwd, encoding: "utf8", ...options }).trimEnd();
  }
  function write(path, content) {
    const destination = join(cwd, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
  function commit() {
    git(["add", "--all"]);
    git(["commit", "-qm", "Fixture"]);
    return git(["rev-parse", "HEAD"]);
  }
  const cleanup = () => rmSync(cwd, { recursive: true, force: true });
  try {
    git(["init", "-q", "-b", "master", `--object-format=${objectFormat}`]);
    git(["config", "user.name", "Test"]);
    git(["config", "user.email", "test@example.invalid"]);
    git(["config", "commit.gpgsign", "false"]);
    git(["config", "core.autocrlf", "false"]);
    git(["config", "core.filemode", "false"]);
    git(["config", "core.hooksPath", join(cwd, ".git", "no-hooks")]);
    write(workflow, "name: Test\non: push\njobs: {}\n");
    write(".github/workflows/other.yml", "name: Other\non: push\njobs: {}\n");
    write("src/add.js", "export const add = (a, b) => a + b;\n");
    write("README.md", "# Fixture\n");
    commit();
    return { cwd, git, write, commit, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function runAction({
  action, repo, body, ref = repo.git(["rev-parse", "HEAD"]), env = {},
}) {
  const temporary = mkdtempSync(join(tmpdir(), "already-tested-event-"));
  try {
    const eventPath = join(temporary, "event.json");
    const outputPath = join(temporary, "output");
    writeFileSync(eventPath, JSON.stringify({ pull_request: { body, head: { sha: ref } } }));
    writeFileSync(outputPath, "");
    const result = spawnSync(process.execPath, [action], {
      cwd: repo.cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_OUTPUT: outputPath,
        GITHUB_WORKSPACE: repo.cwd,
        GITHUB_WORKFLOW_REF: `owner/project/${workflow}@refs/pull/1/merge`,
        GITHUB_WORKFLOW_SHA: repo.git(["rev-parse", "HEAD"]),
        INPUT_CHECK: "unit",
        INPUT_FILES: "",
        ...env,
      },
    });
    if (result.error) throw result.error;
    return { ...result, output: readFileSync(outputPath, "utf8") };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
