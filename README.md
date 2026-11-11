<img src="assets/logo.svg" alt="Green rubber stamp reading Already Tested with a check mark" width="160">

# already-tested

[![Test](https://github.com/dblock/already-tested/actions/workflows/test.yml/badge.svg)](https://github.com/dblock/already-tested/actions/workflows/test.yml) [![Lint](https://github.com/dblock/already-tested/actions/workflows/lint.yml/badge.svg)](https://github.com/dblock/already-tested/actions/workflows/lint.yml) [![Package](https://github.com/dblock/already-tested/actions/workflows/package.yml/badge.svg)](https://github.com/dblock/already-tested/actions/workflows/package.yml)

Skip duplicate CI tests when a trusted local run matches the committed source and workflow. **Claims are not proof that tests ran.**

## Configure CI

Add the gate before setup and tests in `.github/workflows/test.yml`:

```yaml
name: Test
on:
  push:
  pull_request:
    types: [opened, synchronize, reopened, edited]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1
        with:
          fetch-depth: 2
          persist-credentials: false
      - uses: dblock/already-tested@master
        id: tested
        with:
          check: unit-node26-linux
      - uses: actions/setup-node@v7.1.0
        if: steps.tested.outputs.skip != 'true'
        with:
          node-version: 26
      - if: steps.tested.outputs.skip != 'true'
        run: npm ci && npm test
```

Use a distinct `check` per job or matrix environment. Pin a reviewed Action commit instead of `@master` for production.

Missing, stale, or invalid claims run CI normally; pushes always run CI. A match skips the conditioned steps, not the workflow or its required check.

## Claim a Local Run

Requires Git 2.29+ and Node.js 24.x or 26+. Not published to npm yet; clone the CLI beside your project (no dependency installation needed):

```sh
git clone https://github.com/dblock/already-tested.git ../already-tested
```

For the example above, run on Node.js 26 on Linux:

1. Run `npm ci && npm test`.
2. Commit the tested source without further edits.
3. Generate the claim:

```sh
node ../already-tested/bin/already-tested.js claim --workflow .github/workflows/test.yml --check unit-node26-linux \
  --command 'npm ci && npm test' --environment 'Node.js 26 on Linux'
```

Paste the **entire output** into the PR description. It shows expandable validation details and hides the machine-readable claim. Regenerate after source or workflow changes. The CLI records your command and environment; it does not run or verify them.

For agents, add to your project's `AGENTS.md`:

```markdown
Run CI checks locally in their matching environments, commit the tested source, then generate claims with `node ../already-tested/bin/already-tested.js claim --workflow <workflow> --check <check> --command '<actual command>' --environment '<actual Node.js version and OS>'`. Paste the complete output into the PR description. Regenerate after changes; never claim checks or environments you did not validate.
```

By default, claims cover all tracked files plus the workflow. Anyone who can edit the PR description can forge a claim. Untracked files, external state, and environment differences are not verified; keep independent checks where needed.

## Reference

[Options, file filters, API, and limitations](DESIGN.md) | [Contributing](CONTRIBUTING.md) | [Changelog](CHANGELOG.md) | [Releasing](RELEASING.md) | [MIT License](LICENSE)
