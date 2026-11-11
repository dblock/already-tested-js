# Design

## Purpose and Trust

Claims in PR descriptions let trusted agents avoid duplicate tests against matching source and workflows. Anyone who can edit the description can forge a claim. There is no signing, authentication, execution proof, test runner, remote service, or automatic PR editing.

## Public Interface

Public integrations use the `already-tested` executable or `dblock/already-tested@<ref>`, not `node`, `npx`, or repository script paths. Project languages, test commands, and environment descriptions are independent of the tool's implementation language.

Preserve CLI arguments, stdout/stderr, exit codes, claim/hash compatibility, and Action inputs/outputs when changing distribution or replacing JavaScript with a binary. Runtime and packaging are implementation details; standalone binaries and automatic runtime installation are not implemented yet.

The CLI generates claims after local validation. It does not run tests, post to GitHub, or require credentials. The Action reads the event's PR description/head and identifies the executing workflow through `GITHUB_WORKFLOW_REF` and `GITHUB_WORKFLOW_SHA`.

Action inputs: required `check`, optional newline-separated `files`. Output: string `skip`, either `true` or `false`. Condition expensive steps or dependent jobs on that output, without hiding verifier failures. The enclosing workflow still runs.

## CLI and Claim Format

```sh
already-tested claim --workflow .github/workflows/test.yml --check unit
```

Workflow and filter paths are repository-relative, even when invoking from a subdirectory. `--workflow` must be a tracked `.yml`/`.yaml` file directly under `.github/workflows/`. Check identifiers contain 1-128 ASCII letters, numbers, periods, underscores, colons, slashes, or hyphens, starting with a letter or number.

| Option | Meaning |
| --- | --- |
| `--files <pattern>` | Repeat to select files; default: all tracked files |
| `--summary <text>` | Expandable label; default: `<check> - passed` |
| `--command <text>` | Command actually validated; never executed |
| `--environment <text>` | Environment actually validated; never inferred |
| `--raw` | Canonical comment only; incompatible with display metadata |
| `--help` | Usage, also shown with no arguments |
| `--version` | Package version; must be used alone |

Default output is one expandable `details` section with bulleted command/environment when supplied, workflow, check, commit, and content SHA-256. The canonical comment is hidden inline beside the hash. Sections concatenate without blank separators or outer bullets; GitHub controls visual margins.

Display metadata must be nonempty, single-line, and NUL-free. The environment describes the tested project's toolchain/OS, not the CLI runtime. Summary HTML is escaped; detail values use safe code delimiters. Metadata is trusted prose, not a hash input or proof of execution.

Success writes only the section/comment and a final newline to stdout, exiting zero. Errors write to stderr, exit one, and produce no claim. Help/version require no repository.

The canonical comment uses this exact format; the checksum below is illustrative:

```text
<!-- already-tested:v1 {"workflow":".github/workflows/test.yml","check":"unit","hash":"sha256:0000000000000000000000000000000000000000000000000000000000000000"} -->
```

Multiple claims can coexist. Verification searches for the exact expected canonical string; alternate formatting, malformed JSON, unknown versions, and mismatched hashes cannot match.

## File Selection

Default: all tracked files. Filters use Git pathspecs, not shell expansion. Both sides must use the same patterns: trim whitespace, deduplicate, and sort lexically. Equivalent-looking policies remain distinct. Attribute-based pathspecs and selections matching no tracked files are errors.

For example:

```sh
already-tested claim --workflow .github/workflows/test.yml --check unit \
  --files 'src/**' --files 'test/**'
```

Matching Action inputs:

```yaml
with:
  check: unit
  files: |
    src/**
    test/**
```

## Input Matching

Always include the executing workflow, regardless of filters. SHA-256 binds file paths/modes, raw committed bytes, normalized selection policy, and workflow/check identity. Commit IDs are excluded, allowing identical inputs across commits or Git object formats to reuse claims.

Evaluate pathspecs using a temporary index populated from the requested commit; never change the caller's index. Read blobs with one `git cat-file --batch`. Sort UTF-8 paths by JavaScript string comparison. Hash `["already-tested",1,workflow,check,patterns]` as JSON plus a newline; for each sorted file, hash JSON `[path,mode,byteLength]`, a newline, then exactly `byteLength` raw blob bytes.

The CLI reads HEAD and rejects staged/unstaged tracked changes regardless of filters. Ignored/untracked files are excluded: commit all intended inputs. The Action uses PR-head source, not the synthetic merge tree, and the actual executing workflow commit. Base-branch workflow changes invalidate older claims.

Regular files, executables, and binary content are supported. Selected symlinks, submodules, and invalid UTF-8 paths are errors. Each Git command has a 64 MiB output limit, including the combined blob batch. Missing objects, oversized inputs, and Git errors prevent skipping. No fetch commands or working-tree filters run; temporary indexes are cleaned up.

## Workflow Integration

Only `pull_request` events can skip CI. Missing, stale, malformed, or unsupported claims and operational failures produce `skip=false`; failures log a diagnostic and allow normal CI. Failure to write GitHub's output file fails the Action.

Trigger on `opened`, `synchronize`, `reopened`, and `edited` to recheck source and description changes. Use checkout depth 2 with GitHub's default merge checkout; custom/reusable workflows must make both PR-head and executing-workflow commits available. Missing commits run normal CI. Use normal concurrency controls to cancel obsolete runs.

Match CLI and Action `check` values; distinguish jobs and matrix environments. Hashes exclude unselected files, external state, installed toolchains, and service configuration. Claims do not prove compatibility with a newer base or replace branch protection. Preserve independent integration/platform checks; never treat claims as a security boundary.

## This Repository's CI

Test, Lint, and Package use `uses: ./` after depth-2 checkout, before setup/install. They hash all tracked files, recheck description edits, cancel obsolete PR runs, and run normally on pushes or unclaimed checks.

[Contributor instructions](CONTRIBUTING.md#local-ci-claims) map checks to complete commands and matching environments. Coveralls uploads only from actual Node.js 26 Linux CI tests; skips do not upload local or fabricated coverage.

## JavaScript API

```js
import { createClaim, verifyClaim } from "already-tested";

const claim = createClaim({
  workflow: ".github/workflows/test.yml",
  check: "unit",
});
verifyClaim({
  workflow: ".github/workflows/test.yml",
  check: "unit",
  body: claim,
});
```

Both functions are synchronous and accept optional `cwd` and `files`. `createClaim` requires clean tracked HEAD and returns the canonical comment. `verifyClaim` returns a boolean without requiring a clean checkout; `ref` selects source (default HEAD), and `workflowRef` selects the executing workflow (default source ref). Explicit refs must be full lowercase 40- or 64-character commit IDs. Errors throw; absent/non-claim bodies return false without Git access.

## Dependencies and Layout

The current ESM package provides shared `src/` logic, a CLI registered through the package's `bin` mapping, and bundled Action `dist/action.cjs` declared by `action.yml`. Runtime dependencies are Git 2.29+ and public Node.js APIs only. Local installation currently requires Node.js 24.x or 26+; GitHub provides Node.js 24 for the Action. Development uses Node.js 26.

Tests live under `test/`, real-Git/consumer fixtures under `test-support/`, and utilities under `scripts/`. CLI and Action adapters share claim logic.

Tools: esbuild, Node.js tests, c8 coverage, ESLint for JavaScript/Markdown, and a YAML workflow-name checker. Source and installed archives share the same CLI/Action fixture.

## Artwork

`assets/logo.svg` is original editable [MIT-licensed](LICENSE) artwork: green ink, broken double-ring border, tilted lettering, and a check mark. No third-party artwork or embedded fonts.

Preserve its accessible title/description, transparency, system fonts, and outer margin. Keep it first in README above title/badges at width 160 with descriptive alt text, and include it in the package.

Preview with optional `rsvg-convert` from `librsvg`:

```sh
rsvg-convert --width 256 --height 256 --output /tmp/already-tested-logo-full.png assets/logo.svg
rsvg-convert --width 160 --height 160 --output /tmp/already-tested-logo-readme.png assets/logo.svg
```

Inspect both sizes and rendered README for readability, clipping, order, and width. Remove only task-created previews; retain editable source and license.
