# Contributing

## Setup and Validation

Use Node.js 26 LTS for development and Node.js 24 or 26 or later for consumers. `.nvmrc` selects the development major. Install locked dependencies with `npm ci`.

Run `npm run test:coverage` and `npm run lint` locally before every development push, including PR updates. Coverage invokes `npm test`, which uses `node --test`; use `npm test -- --test-name-pattern="<pattern>"` for focused checks. Run final checks immediately before committing and reuse them for the push only if the checked content and configuration are unchanged.

Run `npm run package:check` before committing when package metadata, public entry points, the bundle, or packaging changes. It builds and packs once, inspects the archive, installs that exact artifact with strict consumer engine checks, and exercises the installed API, CLI, and bundled Action against a real Git repository. The source and archive use the same consumer fixture. `npm run build` regenerates the committed Action bundle; include resulting changes.

`npm run lint` checks JavaScript, embedded JavaScript in Markdown, Markdown structure, title-case headings, single-line prose paragraphs, reviewed spelling, and YAML workflow/job/step display names. Add intentional project terms to `.spellcheck.txt`; fix typos instead of broadly suppressing checks. Use title case for human-readable headings and workflow display names, preserving proper names, acronyms, and code identifiers.

Verify and prefer current stable tool versions when adding or updating dependencies, preserving supported runtime compatibility. Keep package consumer engine requirements separate from development tooling requirements; do not bypass strict engine checks for installed artifacts.

## Tests

Keep behavior tests under `test/` and use isolated temporary Git repositories and installed-artifact consumers for integration fixtures as claim behavior is added. Test file changes, selection changes, workflow/check isolation, malformed claims, PR-description edits, and non-PR events. Never execute claim text.

Git 2.29 or later is required. Fixtures live under `test-support/` and clean up their own temporary repositories, events, and output files. Tests cover dirty trees, pathspec policy, committed bytes, SHA-1/SHA-256 object formats, workflow/check isolation, unsupported inputs, executing workflow changes, historical PR heads, description edits, and conservative fallback. `npm run test:coverage` reports line and branch coverage under `coverage/`; aim for close to complete project-owned runtime coverage, inspect uncovered branches, and report meaningful gaps instead of excluding real code or adding trivial tests.

Keep `.github/workflows/test.yml`, `lint.yml`, and `package.yml` separate. Use explicit `matrix.entry` lists of compact inline objects, not generated axes or matrix include/exclude. Test the consumer runtime floor and latest LTS, relevant operating systems, and actual packed entry points. Maintain Coveralls reporting in the test workflow.

## Local CI Claims

This repository runs its own committed Action before installing dependencies. Add claims only after the complete local validation command passed, then commit exactly that tested source and generate claims from a clean checkout. Use the repository CLI directly; no published package or global installation is needed.

| Workflow | Check Identifier | Local Validation |
| --- | --- | --- |
| `.github/workflows/test.yml` | `test-node<NODE>-<OS>` | `npm run test:coverage` on the matching matrix Node major and OS family |
| `.github/workflows/lint.yml` | `lint-node26` | `npm run lint` on Node.js 26; portable across operating systems |
| `.github/workflows/package.yml` | `package-node<NODE>` | `npm run package:check` on Node.js 24 or 26; portable across operating systems |

The Test matrix IDs are `test-node24-ubuntu-latest`, `test-node26-ubuntu-latest`, `test-node26-macos-latest`, and `test-node26-windows-latest`. Do not claim another OS family or Node major, and do not claim a full job after running focused tests. Package validation must include the actual archive and leave the rebuilt bundle committed with no remaining `git diff --exit-code -- dist/`.

For example, after validating Test and Lint on Node.js 26 on macOS, commit the tested source, then generate:

```sh
node bin/already-tested.js claim --workflow .github/workflows/test.yml --check test-node26-macos-latest \
  --command 'npm run test:coverage' --environment 'Node.js 26 on macOS' \
  --summary 'Test: Node.js 26 on macOS - passed'
node bin/already-tested.js claim --workflow .github/workflows/lint.yml --check lint-node26 \
  --command 'npm run lint' --environment 'Node.js 26 on macOS' \
  --summary 'Lint: Node.js 26 - passed'
```

After package validation on a particular Node major, generate the corresponding claim:

```sh
node bin/already-tested.js claim --workflow .github/workflows/package.yml --check package-node26 \
  --command 'npm run package:check && git diff --exit-code -- dist/' \
  --environment 'Node.js 26 on macOS' --summary 'Package: Node.js 26 - passed'
```

Paste each entire generated section into the PR description, directly adjacent without blank separators or outer bullets. The default output has an expandable summary and a tight bulleted list of command, environment, workflow, check, commit, and visible content SHA-256. Its canonical claim stays hidden inline beside that hash; do not add a visible label or code block for it. GitHub controls the remaining disclosure spacing.

Record only the command and environment actually validated; the CLI neither runs nor infers them. Omitted metadata is omitted from the section, not invented. `--summary` overrides the default `<check> - passed` label. `--raw` retains the single-comment format for machine consumers and cannot be combined with display metadata. Display metadata is trusted prose, not an additional hash input or proof of execution.

Omit file filters: CI uses all tracked files, including its workflow. Regenerate after any tracked file changes. The workflow/check identity prevents sharing a claim between jobs. PR-description edits trigger new verification; obsolete PR runs are cancelled. Unclaimed checks and all default-branch push checks run normally. Coverage uploads occur only when the corresponding CI tests ran.

## Pull Requests

Read [Design](DESIGN.md) and [Agent Instructions](AGENTS.md). Work on topic branches from `master` named `<username>/<topic>`, such as `dblock/implementation`, in the existing checkout. Use worktrees only for parallel tasks, with unused paths and distinct branches. Inspect status and existing worktrees before switching; preserve unrelated changes.

Prefer one coherent commit for most PRs; multiple commits are appropriate when independently reviewable. Squash merges are preferred; repository settings also permit rebase merges, but not merge commits. Do not make development commits or direct pushes to `master`, force-push `master`, or merge, publish, create tags/releases, or set credentials without explicit authorization.

Task-owned topic commits may be amended or squashed without further approval. Verify branch ownership and record the remote tip first; reconcile unexpected remote changes. After local tests and lint pass, use `--force-with-lease` against that recorded SHA, never plain force. Do not rewrite another contributor's or task's work.

Keep Markdown paragraphs on one source line. Update affected documentation and append meaningful features, improvements, and fixes to [Changelog](CHANGELOG.md), oldest first within the Next section and immediately above its placeholder. Use the actual PR number and contributor attribution in the existing linked format; predict the shared issue/PR sequence before opening, then verify and correct the assigned number. The initial scaffold and minor typo fixes need no entry.

Include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` on AI-assisted commits. Disclose AI authorship on behalf of `@dblock` in AI-authored PRs/comments. Use closing issue references in PRs rather than closing issues manually.

After local validation of the exact pushed revision, report pending CI without waiting idle; check results during the next relevant task. After authorized merges, fetch with pruning, verify merged state through GitHub, and check for dirty worktrees and dependent stacked PRs. Switch clean checkouts to `master`, remove clean task-created parallel worktrees, and delete merged topic branches. Use forced local branch deletion only after confirming the PR merged and no unmerged work or dependencies would be lost. Never delete dirty worktrees, active PR branches, or `master`.

Follow the version policy in [Agent Instructions](AGENTS.md). Add `UPGRADING.md` when a released behavior changes incompatibly, including during `0.x`; link it from README and describe the released-to-target migration. See [Releasing](RELEASING.md) for the provisional release procedure.
