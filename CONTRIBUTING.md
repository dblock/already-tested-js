# Contributing

## Setup and Validation

Use Node.js 26 (`.nvmrc`) and Git 2.29+:

```sh
npm ci
npm run test:coverage
npm run lint
```

Run coverage and lint immediately before committing each development push. Reuse results only while tested content and configuration are unchanged. For focused tests, use `npm test -- --test-name-pattern="<pattern>"`.

For packaging, metadata, entry-point, or bundle changes, also run `npm run package:check`. It builds, packs, inspects, installs, and tests the actual archive with strict consumer engines. Commit bundle changes from `npm run build`.

Lint checks JavaScript, embedded JavaScript, Markdown, spelling, and workflow display names. Keep prose paragraphs on one source line; use title-case headings and display names. Add intentional terms to `.spellcheck.txt`, not blanket suppressions.

## Tests

Use `test/` for behavior tests and `test-support/` for shared, self-cleaning Git and installed-consumer fixtures. Cover changed behavior and its edge cases; never execute claim text. Inspect line/branch gaps in `coverage/`, aiming for near-complete runtime coverage without trivial assertions or excluding real code.

Keep Test, Lint, and Package workflows separate. Use explicit `matrix.entry` lists of compact inline objects, not generated axes or include/exclude. Cover the consumer runtime floor, latest LTS, relevant operating systems, and packed entry points; retain Coveralls reporting.

Prefer verified current stable dependencies and Actions while preserving runtime compatibility. Development tooling must not weaken consumer engine requirements.

## Local CI Claims

After a complete check passes, commit exactly the tested source and generate its claim from a clean checkout. Use the repository CLI directly; no installation is needed.

| Workflow | Check Identifier | Local Validation |
| --- | --- | --- |
| `.github/workflows/test.yml` | `test-node<NODE>-<OS>` | `npm run test:coverage` on the matching matrix Node major and OS family |
| `.github/workflows/lint.yml` | `lint-node26` | `npm run lint` on Node.js 26; portable across operating systems |
| `.github/workflows/package.yml` | `package-node<NODE>` | `npm run package:check && git diff --exit-code -- dist/` on Node.js 24 or 26; portable across operating systems |

Valid Test IDs: `test-node24-ubuntu-latest`, `test-node26-ubuntu-latest`, `test-node26-macos-latest`, and `test-node26-windows-latest`. Never claim a different Node major/OS family or a full job after focused tests.

For example, after full coverage tests on Node.js 26 on macOS and committing:

```sh
node bin/already-tested.js claim --workflow .github/workflows/test.yml --check test-node26-macos-latest \
  --command 'npm run test:coverage' --environment 'Node.js 26 on macOS' \
  --summary 'Test: Node.js 26 on macOS - passed'
```

Use the table's workflow, check, and command for other claims. Record only the actual command and environment. Paste complete default disclosures directly adjacent, without blank separators or outer bullets; keep the canonical claim hidden inline. See [CLI options](DESIGN.md#cli-and-claim-format) for formatting controls.

Omit file filters: repository CI hashes all tracked files. Regenerate after tracked changes. Description edits trigger verification; unclaimed checks and all push checks run normally. Skipped tests do not upload coverage.

## Pull Requests

Read [Design](DESIGN.md) and [Agent Instructions](AGENTS.md). Use `<username>/<topic>` branches from `master` in the existing checkout; reserve worktrees for parallel tasks. Inspect status/worktrees before switching and preserve unrelated work.

Prefer one coherent commit and squash merges. No development commits/direct pushes to `master`, force-pushes to `master`, or unauthorized merges, publication, credentials, tags, or releases.

Task-owned commits may be amended without asking. Verify ownership, record the remote tip, reconcile unexpected changes, then validate and push with `--force-with-lease` against that SHA. Never use plain force or rewrite another task's work.

Update affected documentation. Append meaningful changes to [Changelog](CHANGELOG.md), oldest first above the Next placeholder, using the existing linked PR/author format. Predict the PR number before opening; verify and correct afterward. Minor typos and the initial scaffold need no entry.

Include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` in AI-assisted commits and disclose AI authorship on behalf of `@dblock` in PRs/comments. Close issues through PR closing references, not manually.

Report pending CI without waiting after exact-revision local validation. After authorized merges, prune-fetch and verify merged state, clean worktrees, and dependencies before removing task-owned worktrees/branches. Force-delete merged local branches only when no unmerged work or dependents would be lost. Never delete dirty worktrees, active PR branches, or `master`.

Follow [versioning rules](AGENTS.md#versioning-and-releases) and [release instructions](RELEASING.md). Document released breaking changes in `UPGRADING.md`, including `0.x` migrations, and link it from README.
