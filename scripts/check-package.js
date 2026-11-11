import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { exerciseConsumer } from "../test-support/consumer.js";

const root = resolve(import.meta.dirname, "..");
const temporary = await mkdtemp(join(tmpdir(), "already-tested-package-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = { ...process.env };
delete env.npm_config_call;
delete env.npm_config_package;

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    shell: process.platform === "win32" && command === npm,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command}: ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  const [packed] = JSON.parse(run(npm, [
    "pack", "--json", "--pack-destination", temporary,
  ], root));
  const names = packed.files.map((file) => file.path);
  for (const path of ["action.yml", "assets/logo.svg", "bin/already-tested.js", "dist/action.cjs", "src/index.js"]) {
    assert.ok(names.includes(path), `Missing packaged file: ${path}`);
  }
  assert.ok(!names.some((path) => /^(?:node_modules|coverage|test|test-support|scripts)\//u.test(path)));
  const consumer = join(temporary, "consumer");
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), JSON.stringify({
    name: "already-tested-consumer",
    private: true,
    type: "module",
  }));
  run(npm, [
    "install", "--ignore-scripts", "--no-audit", "--no-fund", "--engine-strict",
    join(temporary, packed.filename),
  ], consumer);
  run(process.execPath, ["--input-type=module", "-e", "await import('already-tested')"], consumer);
  const installed = join(consumer, "node_modules", "already-tested");
  const action = parse(await readFile(join(installed, "action.yml"), "utf8"));
  exerciseConsumer({
    library: await import(pathToFileURL(join(installed, "src/index.js")).href),
    cli: join(installed, "bin/already-tested.js"),
    action: join(installed, action.runs.main),
  });
  process.stdout.write("Packed consumer API, CLI, and bundled Action checks passed.\n");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
