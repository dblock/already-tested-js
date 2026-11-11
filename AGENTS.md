# Working on already-tested-js

Read [Contributing](CONTRIBUTING.md) and [Design](DESIGN.md) before editing. Claims are trusted statements, not proof of execution.

## Local CI Claims

Follow the [workflow/check/command mapping](CONTRIBUTING.md#local-ci-claims). Run complete checks, commit exactly the tested source, then generate claims with `node bin/already-tested.js claim` from the clean checkout. No file filters; regenerate after tracked changes.

Supply the actual `--command` and `--environment`; never invent metadata or claim checks not run, focused tests as full jobs, or another Node/OS environment. Lint and Package are portable only as specified in the mapping.

Paste unmodified default disclosures adjacent, with no blank separators or outer bullets. Keep machine-readable claims hidden inline; do not expose them in code blocks or use `--raw` for PR descriptions.

## Implementation and Tests

Keep adapters thin around shared `src/` logic. The Action runs committed `dist/action.cjs`; rebuild with `npm run build` after source changes. Use public APIs, Node.js 24 for the Action, Node.js 24.x or 26+ for consumers, and Node.js 26 for development.

Preserve the [hash protocol](DESIGN.md#input-matching): committed PR-head source, executing workflow regardless of filters, paths/modes, selection policy, and check identity. Use isolated temporary indexes and committed blobs. Never mutate the caller's index or execute claim text. Reject selected symlinks, submodules, invalid UTF-8, and attribute-based pathspecs. Missing/stale/malformed claims and operational errors must never skip CI.

Add focused behavior tests with real Git/CLI/installed-consumer fixtures. Inspect coverage gaps; do not exclude real code or add trivial assertions to inflate coverage.

## Validation and Maintenance

Run `npm run test:coverage` and `npm run lint` immediately before committing each development push. Reuse results only for unchanged content/configuration. Also run `npm run package:check` for packaging, entry-point, metadata, or bundle changes.

Follow [validation and test conventions](CONTRIBUTING.md#setup-and-validation), including strict consumer engines, current stable dependencies, separate workflows, explicit `matrix.entry` lists, and Coveralls.

## Documentation and Artwork

Keep prose concise, precise, and on one source line per paragraph. Use title-case headings/display names and review spelling additions. Link shared instructions instead of repeating them; document current behavior, not implementation diaries.

Use the [public CLI/Action interfaces](DESIGN.md#public-interface) in user examples. Keep runtime commands and source paths confined to installation or repository development; describe tested project toolchains, not the tool's implementation language.

Append meaningful changes above the Next changelog placeholder in linked PR/author format. Predict the PR number, then verify it after opening. Minor typos and the initial scaffold need no entry.

Preserve the editable MIT-licensed logo, accessibility, package inclusion, and first position in README at width 160. Follow [artwork instructions](DESIGN.md#artwork); do not replace source artwork with previews.

## Git and GitHub

Use `<username>/<topic>` branches from `master` in the existing checkout; worktrees are for parallel tasks only. Inspect status/worktrees and preserve unrelated work.

Keep one coherent PR commit and use squash merges. Never develop/push directly on `master`, force-push `master`, or merge, publish, configure credentials, or create tags/releases without authorization.

Amend task-owned commits without asking. Before rewriting, verify ownership, record the remote tip, and reconcile unexpected changes. Validate, then use `--force-with-lease` against that SHA; never plain force or rewrite another task's work.

Include the [Copilot co-author trailer](CONTRIBUTING.md#pull-requests) and disclose AI authorship on behalf of `@dblock` in PRs/comments. Close issues through PR references.

After local validation, report pending CI without waiting. After authorized merges, prune-fetch, verify the merge and absence of unmerged work/dependents, switch clean checkouts to `master`, and remove clean task-owned worktrees/merged branches. Never delete dirty worktrees, active PR branches, or `master`.

## Versioning and Releases

Verify the registry before bumping; ask if release status is uncertain. Keep unreleased versions unchanged, including `0.1.0`. After release, bump in the change PR: features increment minor, resetting patch for `0.x` and preserving patch for `1.x` onward. Breaking `0.x` changes increment minor/reset patch; ask before a breaking `1.x`+ major bump. Synchronize manifest, lockfile, and Next heading.

For released breaking changes, including `0.x`, add `UPGRADING.md` with source/target releases, before/after examples, and the introducing PR; link it from README.

[Release instructions](RELEASING.md) are provisional. First publish the inspected `0.1.0` archive manually; only after confirming it in npm may a separate PR configure Trusted Publishing with OIDC. Each release action requires explicit authorization. Never store long-lived npm tokens or overwrite versions/tags.
