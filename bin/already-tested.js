#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";
import { parseArgs } from "node:util";
import { createClaim } from "../src/index.js";

const help = `Usage: already-tested claim --workflow <path> --check <identifier> [--files <pattern> ...]

Run tests against committed source, then paste the generated expandable section into the PR description.

Options:
  --workflow <path>      Tracked .github/workflows/*.yml or *.yaml file
  --check <identifier>   Distinct identifier for the job or matrix environment
  --files <pattern>      Git path pattern; repeat to select files (default: all tracked files)
  --summary <text>       Disclosure label (default: <check> - passed)
  --command <text>       Command already validated; recorded, never executed
  --environment <text>   Environment actually validated; recorded, never inferred
  --raw                 Print only the canonical hidden claim, without display metadata
  --help                Show this help
  --version             Show the package version
`;

function escapeHTML(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function formatClaim(claim, values) {
  const { workflow, check, hash } = JSON.parse(claim.slice("<!-- already-tested:v1 ".length, -" -->".length));
  const commit = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
  const code = (value) => {
    const fence = "`".repeat(Math.max(0, ...[...value.matchAll(/`+/gu)].map((match) => match[0].length)) + 1);
    return `${fence} ${value} ${fence}`;
  };
  const lines = [
    ...(values.command ? [`- **Ran:** ${code(values.command)}`] : []),
    ...(values.environment ? [`- **Environment:** ${code(values.environment)}`] : []),
    `- **Workflow:** ${code(workflow)}`,
    `- **Check:** ${code(check)}`,
    `- **Commit:** ${code(commit)}`,
    `- **Content SHA-256:** ${code(hash.slice("sha256:".length))} ${claim}`,
  ];
  return `<details>\n<summary>${escapeHTML(values.summary ?? `${check} - passed`)}</summary>\n\n${lines.join("\n")}\n\n</details>`;
}

try {
  const args = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args,
    options: {
      workflow: { type: "string" },
      check: { type: "string" },
      files: { type: "string", multiple: true },
      summary: { type: "string" },
      command: { type: "string" },
      environment: { type: "string" },
      raw: { type: "boolean" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
    allowPositionals: true,
  });
  if (values.version) {
    if (args.length !== 1) throw new Error("--version cannot be combined with other arguments.");
    const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    process.stdout.write(`${version}\n`);
  } else if (values.help || args.length === 0) {
    process.stdout.write(help);
  } else {
    if (positionals.length !== 1 || positionals[0] !== "claim") throw new Error(help.trimEnd());
    for (const name of ["summary", "command", "environment"]) {
      if (values[name] !== undefined) {
        if (values.raw) throw new Error("--raw cannot be combined with display metadata.");
        if (!values[name].trim() || /[\0\r\n]/u.test(values[name])) {
          throw new Error(`--${name} must be a nonempty single-line value without NUL characters.`);
        }
      }
    }
    const claim = createClaim({
      workflow: values.workflow, check: values.check, files: values.files,
    });
    process.stdout.write((values.raw ? claim : formatClaim(claim, values)) + "\n");
  }
} catch (error) {
  process.stderr.write(`already-tested: ${error.message}\n`);
  process.exitCode = 1;
}
