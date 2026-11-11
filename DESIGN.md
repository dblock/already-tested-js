# Design

## Purpose and Trust

Avoid repeating tests that an agent claims to have passed locally against identical source and workflow inputs. Claims are trusted statements in a PR description, not cryptographic attestations or proof of execution. Anyone able to edit that description can make a claim; there are no signing keys or new authorization mechanisms.

The scaffold does not implement claims. The following sections define the agreed first implementation.

## Public Interface

Ship one ESM npm package with an `already-tested` executable, shared hashing code under `src/`, and a bundled JavaScript GitHub Action declared by `action.yml`. Bundle the Action into committed `dist/action.cjs` so consumers need no dependency installation. Use Node.js 24 for the Action, the latest supported GitHub JavaScript Action runtime; support Node.js 24 and 26 or later for the CLI. Develop on Node.js 26 LTS.

The planned CLI command is `already-tested claim --workflow <path> --check <identifier>`, with optional file patterns. It generates a machine-readable claim for the PR description after the agent has run the relevant tests. It does not execute tests, post to GitHub, or require GitHub credentials. A claim's exact text format will be specified and tested in the implementation PR.

The Action takes a required `check` identifier and optional newline-separated `files` patterns. It identifies the current workflow and emits the string output `skip`, either `true` or `false`. The enclosing workflow uses this output in conditions on expensive steps or dependent jobs. An Action cannot skip its already-running enclosing workflow, and downstream job results must not hide a failed verifier.

## Input Matching

Default to all Git-tracked files, with optional Git path patterns to narrow the set. Always include the target workflow even when patterns exclude it. Hash a versioned, deterministic representation of file paths, file contents, and the workflow/check identity with SHA-256. Include selection settings so a claim for a narrow selection cannot satisfy a broader one.

Generate and verify against the PR head's committed source, not a local dirty tree or GitHub's synthetic merge commit. The CLI must reject tracked modifications rather than claim they were tested in their committed form. Verification must use the same head source, independent of the checkout default. File additions, deletions, renames, and workflow changes must invalidate affected claims. Sort paths and use unambiguous framing; never depend on filesystem traversal order or text-line endings introduced by checkout.

Do not silently treat unsupported inputs such as submodules as an empty file set. Define and test supported file types, path patterns, and errors before implementing skip decisions.

## Workflow Integration

Read PR description text as data, never shell commands. Missing, malformed, unknown-version, or stale claims mean `skip=false` and normal CI execution. Non-PR events run CI normally. Operational failures must never produce `skip=true` or silently suppress test execution.

The caller must trigger verification when PR source or its description changes, including `pull_request` activity `edited`. The hash binds a specific workflow and check identifier; separate jobs or matrix environments need distinct identifiers. Changing a description must not reuse an old successful verification result.

The claim is only as good as the selected inputs and trusted author. Hashes do not capture unselected files, external state, installed toolchains, or service configuration, and a local result does not prove a merge with a newer base passes. Preserve any integration, platform, or merge checks that local claims cannot replace.

## Dependencies and Layout

Prefer Node.js public APIs for cryptography, arguments, filesystem access, and subprocesses. No runtime dependencies exist in the scaffold; add only dependencies the implementation actually needs. Keep CLI and Action adapters thin around shared claim logic. Tests live under `test/`; build and validation utilities live under `scripts/`.

The scaffold uses esbuild for bundling, the built-in Node.js test runner with c8 coverage, ESLint for JavaScript and Markdown, and a YAML-aware workflow display-name checker. Keep Test, Lint, and Package workflows separate.

## Non-goals

No signing, independent execution proof, test-runner adapters, automatic test selection, remote service, registry credentials, automated PR editing, or claim-based skipping for this project's own scaffold CI.

## Maintenance

Keep this document focused on current behavior, the agreed interface, and relevant constraints. Remove superseded proposals and implementation diaries; Git history preserves past decisions.
