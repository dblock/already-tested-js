#!/usr/bin/env node

import { readFileSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";
import { parseArgs } from "node:util";
import { createClaim } from "../src/index.js";

const help = `Usage: already-tested claim --workflow <path> --check <identifier> [--files <pattern> ...]

Run tests against committed source, then paste the generated claim into the PR description.

Options:
  --workflow <path>      Tracked .github/workflows/*.yml or *.yaml file
  --check <identifier>   Distinct identifier for the job or matrix environment
  --files <pattern>      Git path pattern; repeat to select files (default: all tracked files)
  --help                Show this help
  --version             Show the package version
`;

try {
  const args = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args,
    options: {
      workflow: { type: "string" },
      check: { type: "string" },
      files: { type: "string", multiple: true },
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
    process.stdout.write(createClaim({
      workflow: values.workflow, check: values.check, files: values.files,
    }) + "\n");
  }
} catch (error) {
  process.stderr.write(`already-tested: ${error.message}\n`);
  process.exitCode = 1;
}
