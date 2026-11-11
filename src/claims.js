import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const prefix = "<!-- already-tested:v1 ";

function git(cwd, args, options = {}) {
  return execFileSync("git", args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1", ...options.env },
  });
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) throw new TypeError("files must be an array of Git path patterns.");
  const patterns = files.map((pattern) => {
    if (typeof pattern !== "string" || pattern.trim() === "" || pattern.includes("\0")) {
      throw new TypeError("File patterns must be nonempty strings without NUL characters.");
    }
    const normalized = pattern.trim();
    if (/^:\([^)]*\battr(?:[:\s)])/u.test(normalized)) {
      throw new Error("Attribute-based Git path patterns are not supported.");
    }
    return normalized;
  });
  return [...new Set(patterns)].sort();
}

function entries(buffer) {
  const text = buffer.toString("utf8");
  if (!Buffer.from(text).equals(buffer)) throw new Error("File paths must be valid UTF-8.");
  return text.split("\0").filter(Boolean).map((record) => {
    const [, mode, oid, path] = /^(\d{6}) ([0-9a-f]+) 0\t([\s\S]+)$/u.exec(record);
    return { mode, oid, path };
  });
}

function snapshot({ cwd = process.cwd(), workflow, check, files = [], ref = "HEAD", workflowRef = ref }) {
  if (typeof workflow !== "string" || !/^\.github\/workflows\/[^/\\\0\r\n]+\.ya?ml$/u.test(workflow)) {
    throw new Error("workflow must be a file under .github/workflows/ ending in .yml or .yaml.");
  }
  if (typeof check !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/u.test(check)) {
    throw new Error("check must be 1-128 characters using letters, numbers, '.', '_', ':', '/', or '-'.");
  }
  for (const value of [ref, workflowRef]) {
    if (value !== "HEAD" && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value)) {
      throw new Error("ref and workflowRef must be HEAD or full lowercase Git commit IDs.");
    }
  }
  const patterns = normalizeFiles(files);
  const root = git(cwd, ["rev-parse", "--show-toplevel"]).replace(/\r?\n$/u, "");
  const commit = git(root, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  const temporary = mkdtempSync(join(tmpdir(), "already-tested-index-"));
  const env = { GIT_INDEX_FILE: join(temporary, "index") };
  try {
    // Evaluate pathspecs against this commit, never the caller's working index.
    git(root, ["-c", `core.hooksPath=${temporary}`, "read-tree", commit], { env });
    const selected = entries(git(root, ["ls-files", "--stage", "-z", "--", ...patterns], {
      env, encoding: null,
    }));
    if (workflowRef !== ref) {
      const workflowCommit = git(root, ["rev-parse", "--verify", `${workflowRef}^{commit}`]).trim();
      git(root, ["-c", `core.hooksPath=${temporary}`, "read-tree", workflowCommit], { env });
    }
    const workflowEntries = entries(git(root, [
      "ls-files", "--stage", "-z", "--", `:(top,literal)${workflow}`,
    ], { env, encoding: null }));
    if (workflowEntries.length !== 1) throw new Error(`Workflow is not tracked: ${workflow}`);
    if (selected.length === 0) throw new Error("File patterns matched no tracked files.");
    const combined = [...new Map([...selected, ...workflowEntries].map((entry) => [entry.path, entry])).values()]
      .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    for (const entry of combined) {
      if (!["100644", "100755"].includes(entry.mode)) {
        throw new Error(`Unsupported file mode ${entry.mode}: ${entry.path}`);
      }
    }
    const contents = git(root, ["cat-file", "--batch"], {
      input: combined.map((entry) => entry.oid).join("\n") + "\n",
      encoding: null,
    });
    const hash = createHash("sha256").update(JSON.stringify([
      "already-tested", 1, workflow, check, patterns,
    ]) + "\n");
    let offset = 0;
    for (const entry of combined) {
      const newline = contents.indexOf(10, offset);
      const header = /^([0-9a-f]+) blob (\d+)$/u.exec(contents.subarray(offset, newline).toString("ascii"));
      if (!header || header[1] !== entry.oid) throw new Error(`Cannot read committed file: ${entry.path}`);
      const size = Number(header[2]);
      const start = newline + 1;
      hash.update(JSON.stringify([entry.path, entry.mode, size]) + "\n");
      hash.update(contents.subarray(start, start + size));
      offset = start + size + 1;
    }
    return `${prefix}${JSON.stringify({ workflow, check, hash: `sha256:${hash.digest("hex")}` })} -->`;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

export function createClaim({ cwd = process.cwd(), ...options }) {
  if (git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=no"]).length > 0) {
    throw new Error("Commit tracked changes before generating a claim, then test that committed source.");
  }
  return snapshot({ ...options, cwd, ref: "HEAD", workflowRef: "HEAD" });
}

export function verifyClaim({ body, ...options }) {
  if (typeof body !== "string" || !body.includes(prefix)) return false;
  return body.includes(snapshot(options));
}
