# Working on already-tested

Read [Contributing](CONTRIBUTING.md) and [Design](DESIGN.md) before editing. This project trusts content-matched local-test claims in PR descriptions to avoid duplicate CI. It does not prove execution, sign evidence, run tests for callers, or operate a remote service.

## Local CI Claims

This repository uses its committed local Action in Test, Lint, and Package. After the required local validation passes, commit exactly those files, then use `node bin/already-tested.js claim` from the clean checkout and paste each complete generated section into the PR description. Default to all tracked files, matching CI; do not pass file filters here. Regenerate claims after any tracked file changes.

Use the default compact disclosure format: one expandable summary per check, no outer bullets or blank separators between sections, a tight bulleted list of validation details inside, and the canonical machine-readable claim hidden inline beside the visible content SHA-256. Do not wrap the claim in a code block or add a visible machine-readable-claim label. Supply `--command` with the complete command actually validated, `--environment` with its actual Node version and OS, and optionally `--summary` with a concise passed-check label. These are trusted descriptions, not execution evidence; never infer or invent them. `--raw` is only for tools needing the old single-comment output, not normal PR descriptions.

Claim only complete checks actually run successfully, not focused tests or another matrix environment. Test IDs are `test-node24-ubuntu-latest`, `test-node26-ubuntu-latest`, `test-node26-macos-latest`, and `test-node26-windows-latest`; use only the Node major and OS family actually tested. Portable lint uses `lint-node26` after `npm run lint` on Node.js 26. Portable package checks use `package-node24` or `package-node26` after `npm run package:check` on that Node major, with the rebuilt bundle committed and no remaining bundle diff.

For example, after running full coverage tests on Node.js 26 on macOS, committing the validated source, and leaving no tracked changes:

```sh
node bin/already-tested.js claim --workflow .github/workflows/test.yml --check test-node26-macos-latest \
  --command 'npm run test:coverage' --environment 'Node.js 26 on macOS' \
  --summary 'Test: Node.js 26 on macOS - passed'
```

See [Local CI Claims](CONTRIBUTING.md#local-ci-claims) for all workflow/command mappings. Never claim Linux or Windows test legs from macOS. Claims are trusted statements; do not invent, copy stale, or manually alter them. Missing claims run CI normally; default-branch pushes always run all checks.

## Implementation and Tests

Keep shared claim logic under `src/`, the CLI under `bin/`, behavior tests under `test/`, and validation utilities under `scripts/`. `action.yml` runs committed `dist/action.cjs`, rebuilt with `npm run build`. Use public dependency APIs and supported Node.js APIs. The Action targets Node.js 24; consumers support Node.js 24 and 26 or later; development uses Node.js 26 LTS.

Bind claims to a versioned hash of selected committed files, file paths/modes, selection policy, workflow, and check identity. Include the executing workflow regardless of filters, even when its commit differs from the PR head. Match source from the PR head, not a dirty tree or default synthetic merge checkout. Use isolated temporary Git indexes and committed blobs, never mutate the caller's index or execute claim text. Reject selected symlinks, submodules, invalid UTF-8, and attribute-based pathspecs. Never turn missing/malformed/stale evidence or operational errors into a skip.

Keep adapters thin and add focused behavior tests plus real Git/CLI/installed-consumer fixtures. `test-support/consumer.js` exercises the same round trip against source and the actual installed archive. Aim for near-complete project-owned runtime coverage and inspect line/branch gaps with `npm run test:coverage`; do not exclude real code or inflate coverage with trivial assertions.

## Validation and Maintenance

Install with `npm ci`. Run `npm run test:coverage` and `npm run lint` locally before every development push. Run final validation immediately before committing, reusing results only for unchanged content and configuration. Use `npm test -- --test-name-pattern="<pattern>"` for focused tests. Run `npm run package:check` before committing when packaging, entry points, metadata, or the bundle changes; it validates an actual packed consumer with strict engines. Rebuild and commit the Action bundle when its source changes.

Verify and prefer latest stable dependencies, runtimes, and Actions when selecting or updating them, while preserving supported-runtime compatibility. Do not relax consumer engine requirements to accommodate development tools.

Keep Test, Lint, and Package in separate workflows and maintain Coveralls reporting. Matrices use `matrix.entry` arrays of compact inline objects, never include/exclude or generated axes.

Use title case for human-readable Markdown headings and YAML workflow/job/step names, preserving proper names, acronyms, and identifiers. Keep Markdown prose on one source line. `npm run lint` includes ESLint checks for code, embedded JavaScript, Markdown style, headings, spelling, and a YAML-aware display-name checker. Review additions to `.spellcheck.txt` rather than suppressing spelling errors.

Update affected documentation and keep Design focused on current behavior and relevant rationale, not diaries or superseded proposals. Add linked changelog entries for meaningful features, improvements, and fixes, not minor typos or the initial scaffold. Predict the next PR number, verify it after opening, and correct discrepancies. Entries use `- [#123](https://github.com/dblock/already-tested/pull/123): Description - [@author](https://github.com/author).` Append oldest-to-newest immediately above `- Your contribution here.` in the Next section.

## Artwork

Preserve the original editable `assets/logo.svg`, its MIT license, and its accessible title/description. Keep the logo first in README at width 160, above the project title and badges, and include it in the package. Follow [Artwork](DESIGN.md#artwork) for provenance, editing, temporary rendering commands, and full-size/README-size inspection; do not replace the source with a generated preview.

## Git and GitHub

Use topic branches from `master` named `<username>/<topic>`, such as `dblock/implementation`, in the existing checkout. Worktrees are only for parallel tasks; use unused paths. Inspect status and worktrees before switching and preserve unrelated changes.

Prefer one coherent commit per PR; allow independently reviewable commits when useful. Prefer squash merges; rebase merges are also allowed, merge commits are not. No direct default-branch development commits/pushes, no force-push to `master`, and no merge, publication, credential setup, or tags/releases without explicit authorization.

Amend or squash task-owned PR commits without asking again. Verify ownership and record the remote tip before rewriting, reconcile remote changes, validate locally, then push with `--force-with-lease` against the recorded SHA. Never use plain force or rewrite another task's work.

Include the Copilot co-author trailer on AI-assisted commits and disclose AI authorship on behalf of `@dblock` on AI-authored PRs/comments. Let PR closing references close issues on merge instead of manually closing them.

Do not wait idle for CI after local checks pass for the exact pushed revision; report pending checks and inspect them during the next relevant task. After merges, fetch with pruning and verify the PR's merged state via GitHub. Inspect dirty worktrees and stacked dependencies; switch clean checkouts to `master`, remove clean task-created parallel worktrees, and delete merged local topic branches. Force-delete a local branch only after verifying the merge and absence of unmerged work or dependents. Never delete dirty worktrees, active PR branches, or `master`.

## Versioning and Releases

Before any version bump, verify the current registry release; ask if release status is uncertain. Keep an unreleased version unchanged, including the initial `0.1.0`. After a release, include the bump in the change PR. Features increment minor, resetting patch for `0.x` and preserving patch for `1.x` and later. Breaking changes in `0.x` increment minor and reset patch without requesting a major; ask before a major bump for breaking changes in `1.x` and later. Synchronize manifest, lockfile, and Next changelog heading.

Document released breaking behavior and migration in `UPGRADING.md` in the same PR, including `0.x`; link it from README, identify the source and target releases, give before/after examples, and link the introducing PR.

Release instructions are provisional; see [Releasing](RELEASING.md). The first npm release is planned as a manually authorized `0.1.0` publication of the inspected tarball. Only after confirming it in npm should a focused PR configure npm Trusted Publishing with OIDC for subsequent releases. Publication, interactive authentication, publisher setup, tags/releases, and dispatch each require explicit authorization. Never store long-lived npm tokens or overwrite a published version or release tag.
