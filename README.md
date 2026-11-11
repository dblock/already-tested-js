# already-tested

[![Test](https://github.com/dblock/already-tested/actions/workflows/test.yml/badge.svg)](https://github.com/dblock/already-tested/actions/workflows/test.yml) [![Lint](https://github.com/dblock/already-tested/actions/workflows/lint.yml/badge.svg)](https://github.com/dblock/already-tested/actions/workflows/lint.yml) [![Package](https://github.com/dblock/already-tested/actions/workflows/package.yml/badge.svg)](https://github.com/dblock/already-tested/actions/workflows/package.yml)

Skip duplicate CI tests using trusted, content-matched claims in pull request descriptions.

**Status:** scaffold only. Claim generation and verification are not implemented. This is a trust-based optimization, not proof that tests ran.

## Installation

Not released. The planned integration is a GitHub Action plus an npm CLI for agents. The Action uses GitHub's Node.js 24 runtime; the CLI targets Node.js 24 and 26 or later.

## Usage

Not implemented yet. The intended flow is: run tests locally, generate a claim, paste it into the PR description, then let the Action decide whether the workflow can skip duplicate tests. See [Design](DESIGN.md) for scope and constraints.

## Contributing

Read [Contributing](CONTRIBUTING.md), [Design](DESIGN.md), [Changelog](CHANGELOG.md), [Releasing](RELEASING.md), and [Agent Instructions](AGENTS.md).

## License

[MIT](LICENSE).
