# Design

## Purpose and Trust

Avoid repeating tests that an agent claims to have passed locally against identical source and workflow inputs. Claims are trusted statements in a PR description, not cryptographic attestations or proof of execution. Anyone able to edit that description can make a claim; there are no signing keys or new authorization mechanisms.

## Public Interface

One ESM npm package provides the `already-tested` executable, shared hashing code under `src/`, and a bundled JavaScript GitHub Action declared by `action.yml`. The committed `dist/action.cjs` needs no dependency installation. The Action uses Node.js 24, GitHub's latest supported JavaScript Action runtime; the CLI supports Node.js 24 and 26 or later. Develop on Node.js 26 LTS. Git 2.29 or later must be available.

The CLI command is `already-tested claim --workflow <path> --check <identifier>`, with optional repeated `--files <pattern>` options. It generates an expandable PR-description section containing a hidden machine-readable claim after the agent has tested the exact committed source. It does not execute tests, post to GitHub, or require GitHub credentials.

The Action takes a required `check` identifier and optional newline-separated `files` patterns. It identifies the executing workflow using `GITHUB_WORKFLOW_REF` and `GITHUB_WORKFLOW_SHA`, reads the PR description/head from the event payload, and emits the string output `skip`, either `true` or `false`. The enclosing workflow uses this output in conditions on expensive steps or dependent jobs. An Action cannot skip its already-running enclosing workflow, and downstream job results must not hide a failed verifier.

## CLI and Claim Format

Run the CLI from any directory inside the target checkout. Workflow paths and file patterns are relative to the repository root. `--workflow` must name a tracked file directly under `.github/workflows/` ending in `.yml` or `.yaml`. A check identifier has 1-128 ASCII letters, numbers, periods, underscores, colons, slashes, or hyphens, beginning with a letter or number.

Print one complete `details` section to stdout with a final newline, no progress logs, and exit zero. Each section has one expandable summary, no outer bullet, a tight bulleted list of details, and the canonical comment hidden inline on the content SHA-256 bullet. Concatenating outputs adds no blank separators; GitHub controls disclosure margins. The summary defaults to `<check> - passed`; workflow, check, commit, and visible content SHA-256 are always included.

Optional `--summary`, `--command`, and `--environment` provide the display label, command actually validated, and environment actually validated. Commands are never executed, environments are not inferred, and omitted metadata stays omitted. These nonempty, single-line values cannot contain NUL characters. Escape summary HTML and use safe inline code delimiters for detail values. Metadata is trusted presentation, not an extra hash input or independent validation.

`--raw` prints only the original canonical comment and cannot be combined with display metadata. The JavaScript `createClaim` API still returns that canonical comment. Errors print to stderr, exit one, and produce no claim. `--help` or no arguments prints usage without requiring a repository; `--version` alone prints the package version and cannot be combined with any other argument.

Claims are single-line HTML comments, pasted verbatim. This example uses an illustrative checksum:

```text
<!-- already-tested:v1 {"workflow":".github/workflows/test.yml","check":"unit","hash":"sha256:0000000000000000000000000000000000000000000000000000000000000000"} -->
```

Multiple claims can coexist in a description. Verification computes the expected canonical claim and looks for that exact string; it does not parse or execute claim content. Alternate formatting, malformed JSON, unknown versions, and mismatched hashes cannot match.

## File Selection

Omit patterns to select all tracked files. Otherwise use Git pathspec syntax, not shell expansion. Trim patterns, deduplicate them, and sort them lexically; both sides must use the same normalized selection policy. Equivalent-looking policies are intentionally distinct. Attribute-based pathspecs are unsupported because they can consult working-tree state. A selection matching no tracked files is an error, not a workflow-only claim.

For example, the CLI can select source and tests:

```sh
npx already-tested claim --workflow .github/workflows/test.yml --check unit \
  --files 'src/**' --files 'test/**'
```

Configure the same Action inputs:

```yaml
with:
  check: unit
  files: |
    src/**
    test/**
```

## Input Matching

Always include the executing workflow even when file patterns exclude it. Hash a versioned, deterministic representation of file paths, file modes, raw committed file content, normalized selection policy, and workflow/check identity with SHA-256. The digest does not include commit IDs, so equivalent source across commits or Git object formats can reuse the same claim.

Use a temporary Git index populated from the requested commit to evaluate pathspecs without changing the caller's index or relying on checkout state. Read selected blobs in one `git cat-file --batch` invocation. UTF-8 paths sort lexically by JavaScript string comparison. Hash the JSON array `["already-tested",1,workflow,check,patterns]` followed by a newline; for each sorted file hash the JSON array `[path,mode,byteLength]`, a newline, then exactly that many raw blob bytes. Lengths frame binary content unambiguously.

The CLI reads HEAD and rejects staged/unstaged tracked changes, regardless of filters. Untracked and ignored files are outside the claim: commit all intended inputs before claiming. The Action reads selected source from the PR head, not GitHub's synthetic merge tree, but reads the workflow from the actual executing workflow commit. A base-branch workflow change therefore invalidates an older claim even if the PR head did not change.

Regular tracked files, including executables and binary content, are supported. Selected symlinks, submodules, and invalid UTF-8 paths are errors; narrow the selection only when the excluded inputs truly cannot affect the check. Each Git command has a 64 MiB output limit, including the combined blob batch. Missing objects, oversized inputs, and Git errors prevent skipping. The Action does not issue fetch commands, no working-tree filters execute while reading blobs, and temporary indexes are cleaned up.

## Workflow Integration

Only `pull_request` events are eligible, including `edited`; push, manual dispatch, merge-queue, and `pull_request_target` events produce `skip=false`. Missing, malformed, unknown-version, or stale claims mean `skip=false`. Operational verification failures log a diagnostic, emit `skip=false`, and exit successfully so ordinary CI can proceed. Inability to write GitHub's output file fails the Action rather than pretending it delivered a decision.

Trigger on PR source and description changes, including `opened`, `synchronize`, `reopened`, and `edited`. With GitHub's default merge checkout use `actions/checkout` with `fetch-depth: 2` to make both PR head and workflow commits available; custom/reusable workflow checkouts must make those specific commits available too. Missing commits result in normal CI, never a skip. For concurrent runs, use the caller's normal concurrency policy to cancel obsolete runs.

Use a distinct `check` value per job or matrix environment and copy the same value into the CLI invocation. A claim is only as good as its selected inputs and trusted author. Hashes do not capture unselected files, external state, installed toolchains, test commands outside selected files, or service configuration. The Action does not authenticate the claimant, prevent a trusted author from lying, or prove integration with a newer base passes. Preserve checks that local claims cannot replace. Do not use this as a security boundary or as a substitute for branch protection.

## This Repository's CI

Test, Lint, and Package use `uses: ./` to execute the committed bundle after checkout with depth 2, before runtime setup or dependency installation. They use all tracked files, support PR-description edits, and cancel obsolete runs for the same PR without grouping independent push runs. A matching claim skips setup and the corresponding validation steps; missing/stale claims and all pushes execute normal CI.

Each Test matrix leg has a `test-node<NODE>-<OS>` identity and requires local validation on that Node major and OS family. Portable Lint uses `lint-node26`; portable Package uses `package-node24` or `package-node26` and includes its committed-bundle check. [Contributor instructions](CONTRIBUTING.md#local-ci-claims) map identities to complete local validation commands. A local macOS Test run does not replace Linux or Windows tests.

Coveralls uploads remain restricted to actual Node.js 26 Linux test runs, not jobs whose tests were skipped. Claim-based skips do not upload local coverage or manufacture a coverage report. The integration uses no release tag, registry publication, extra permission, or runtime dependency.

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

Both functions are synchronous and accept optional `cwd` and `files` properties. `createClaim` always uses a clean tracked HEAD and returns the canonical string. `verifyClaim` returns a boolean, accepts `ref` for source and `workflowRef` for the executing workflow, and does not require a clean checkout. References default to HEAD and the source reference respectively; explicit references must be full lowercase 40- or 64-character commit IDs. Operational or configuration errors throw; missing bodies or bodies without a claim return false without accessing Git.

## Dependencies and Layout

Use only Node.js public APIs and the Git executable at runtime; there are no runtime npm dependencies. Keep CLI and Action adapters thin around shared claim logic. Tests live under `test/`, shared real-Git and consumer fixtures under `test-support/`, and build/validation utilities under `scripts/`.

Use esbuild for bundling, the built-in Node.js test runner with c8 coverage, ESLint for JavaScript and Markdown, and a YAML-aware workflow display-name checker. Keep Test, Lint, and Package workflows separate. Source and installed-artifact checks share the same real CLI/Action round-trip fixture.

## Non-goals

No signing, independent execution proof, test-runner adapters, automatic test selection, remote service, registry credentials, or automated PR editing.

## Artwork

The approved Rubber Stamp concept is original editable SVG artwork in `assets/logo.svg`, covered by the project's [MIT license](LICENSE). No third-party artwork or embedded font files are used. The green ink, broken double-ring border, tilted lettering, and check mark represent a trusted claim that work was already done, not an independent certification.

Edit the SVG source directly. Preserve its accessible title/description, transparent background, system-font fallback, and generous outer margin. Keep it first in README, above the title and badges, using an image with descriptive alternative text and a 160-pixel display width. Include the artwork in the npm archive so packaged README images resolve.

The animated variation adds an original transparent green outline stamper in `assets/stamp.svg`, also covered by MIT. It uses the logo's ink color, simple unfilled paths, and no gradients or shading. `scripts/render-logo.js` composes both SVG sources into `assets/logo-animated.gif`: the logo stays at its original position and scale throughout, while only the stamper quickly lifts up and away, returns for a brief press, then exits. There is no unfolding, stretching, fading, or movement of the green logo. Motion finishes in under a second; the transparent, 320-pixel GIF plays once and stays on the original logo rather than looping. README uses a `picture` element to serve the original SVG when reduced motion is requested.

Regenerate locally with Node.js 26, `rsvg-convert` from `librsvg`, and FFmpeg; these are optional artwork tools, not runtime or CI dependencies:

```sh
node scripts/render-logo.js
```

The renderer creates temporary frames outside the checkout and removes them after encoding. Review the GIF at full size and README width, including the initial stamp, contact, lift, and final mark on light and dark backgrounds. Check that it plays only once, has no trails or clipping, and ends on the original logo. Preserve the renderer, both editable SVG sources, and the GIF together; normal installation and CI use the committed asset and do not regenerate it.

Create temporary previews with `rsvg-convert` from `librsvg`:

```sh
rsvg-convert --width 256 --height 256 --output /tmp/already-tested-logo-full.png assets/logo.svg
rsvg-convert --width 160 --height 160 --output /tmp/already-tested-logo-readme.png assets/logo.svg
```

Inspect both sizes for readable lettering, a clear check mark, and borders without clipping. Verify the rendered README preserves the logo/title/badges order and declared width. Keep preview files outside the package, remove only previews created for the task, and retain the editable source and license when updating artwork.

## Maintenance

Keep this document focused on current behavior, the agreed interface, and relevant constraints. Remove superseded proposals and implementation diaries; Git history preserves past decisions.
