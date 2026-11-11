import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { parse } from "yaml";

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
  for (const path of ["action.yml", "bin/already-tested.js", "dist/action.cjs", "src/index.js"]) {
    assert.ok(names.includes(path), `Missing packaged entry point: ${path}`);
  }
  assert.ok(!names.some((path) => /^(?:node_modules|coverage|test|scripts)\//u.test(path)));
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
  for (const path of ["bin/already-tested.js", action.runs.main]) {
    const result = spawnSync(process.execPath, [join(installed, path)], {
      cwd: consumer,
      encoding: "utf8",
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1, `${path} must not claim to implement functionality.`);
    assert.match(result.stderr, /already-tested is not implemented yet/u);
  }
  process.stdout.write("Packed consumer import and scaffold CLI/Action checks passed.\n");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
