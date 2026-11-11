var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/action.js
var import_node_fs2 = require("node:fs");
var import_node_process2 = __toESM(require("node:process"), 1);

// src/claims.js
var import_node_buffer = require("node:buffer");
var import_node_child_process = require("node:child_process");
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var import_node_process = __toESM(require("node:process"), 1);
var prefix = "<!-- already-tested:v1 ";
function git(cwd, args, options = {}) {
  return (0, import_node_child_process.execFileSync)("git", args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
    env: { ...import_node_process.default.env, GIT_NO_REPLACE_OBJECTS: "1", ...options.env }
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
  if (!import_node_buffer.Buffer.from(text).equals(buffer)) throw new Error("File paths must be valid UTF-8.");
  return text.split("\0").filter(Boolean).map((record) => {
    const [, mode, oid, path] = /^(\d{6}) ([0-9a-f]+) 0\t([\s\S]+)$/u.exec(record);
    return { mode, oid, path };
  });
}
function snapshot({ cwd = import_node_process.default.cwd(), workflow, check, files = [], ref = "HEAD", workflowRef = ref }) {
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
  const temporary = (0, import_node_fs.mkdtempSync)((0, import_node_path.join)((0, import_node_os.tmpdir)(), "already-tested-index-"));
  const env = { GIT_INDEX_FILE: (0, import_node_path.join)(temporary, "index") };
  try {
    git(root, ["-c", `core.hooksPath=${temporary}`, "read-tree", commit], { env });
    const selected = entries(git(root, ["ls-files", "--stage", "-z", "--", ...patterns], {
      env,
      encoding: null
    }));
    if (workflowRef !== ref) {
      const workflowCommit = git(root, ["rev-parse", "--verify", `${workflowRef}^{commit}`]).trim();
      git(root, ["-c", `core.hooksPath=${temporary}`, "read-tree", workflowCommit], { env });
    }
    const workflowEntries = entries(git(root, [
      "ls-files",
      "--stage",
      "-z",
      "--",
      `:(top,literal)${workflow}`
    ], { env, encoding: null }));
    if (workflowEntries.length !== 1) throw new Error(`Workflow is not tracked: ${workflow}`);
    if (selected.length === 0) throw new Error("File patterns matched no tracked files.");
    const combined = [...new Map([...selected, ...workflowEntries].map((entry) => [entry.path, entry])).values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    for (const entry of combined) {
      if (!["100644", "100755"].includes(entry.mode)) {
        throw new Error(`Unsupported file mode ${entry.mode}: ${entry.path}`);
      }
    }
    const contents = git(root, ["cat-file", "--batch"], {
      input: combined.map((entry) => entry.oid).join("\n") + "\n",
      encoding: null
    });
    const hash = (0, import_node_crypto.createHash)("sha256").update(JSON.stringify([
      "already-tested",
      1,
      workflow,
      check,
      patterns
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
    (0, import_node_fs.rmSync)(temporary, { recursive: true, force: true });
  }
}
function verifyClaim({ body, ...options }) {
  if (typeof body !== "string" || !body.includes(prefix)) return false;
  return body.includes(snapshot(options));
}

// src/action.js
var skip = false;
try {
  if (import_node_process2.default.env.GITHUB_EVENT_NAME === "pull_request") {
    const event = JSON.parse((0, import_node_fs2.readFileSync)(import_node_process2.default.env.GITHUB_EVENT_PATH, "utf8"));
    const ref = event.pull_request?.head?.sha;
    if (typeof ref !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(ref)) {
      throw new Error("The PR head commit ID is missing or invalid.");
    }
    const workflowRef = import_node_process2.default.env.GITHUB_WORKFLOW_SHA;
    if (typeof workflowRef !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(workflowRef)) {
      throw new Error("The executing workflow commit ID is missing or invalid.");
    }
    const workflow = /^[^/]+\/[^/]+\/(.+?)@refs\//u.exec(import_node_process2.default.env.GITHUB_WORKFLOW_REF ?? "")?.[1];
    skip = verifyClaim({
      cwd: import_node_process2.default.env.GITHUB_WORKSPACE,
      ref,
      workflowRef,
      workflow,
      check: import_node_process2.default.env.INPUT_CHECK,
      files: (import_node_process2.default.env.INPUT_FILES ?? "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean),
      body: event.pull_request.body
    });
  }
} catch (error) {
  import_node_process2.default.stdout.write(`already-tested: ${error.message.replace(/[\r\n]/gu, " ")} Running CI normally.
`);
}
(0, import_node_fs2.appendFileSync)(import_node_process2.default.env.GITHUB_OUTPUT, `skip=${skip}
`);
import_node_process2.default.stdout.write(`already-tested: ${skip ? "Matching claim; duplicate tests may be skipped." : "No verified claim; run CI normally."}
`);
