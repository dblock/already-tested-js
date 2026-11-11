# Releasing

## Status

Unreleased; no release automation, trusted publisher, credentials, or tags are configured. These provisional instructions authorize nothing.

## Version and Validation

Check npm before bumping; unreleased `0.1.0` stays unchanged. Follow [versioning rules](AGENTS.md#versioning-and-releases).

Validate the exact revision with coverage, lint, and package checks from [Contributing](CONTRIBUTING.md#setup-and-validation). Confirm the committed bundle matches the build. Create and inspect a retained tarball with `npm pack --json`, then install/test that exact archive in an isolated strict-engine consumer using the real CLI and Action.

## First Publication

The first release is manual `0.1.0`. Publication, interactive authentication, publisher setup, dispatch, tags, and releases each require explicit authorization. Use npm's supported login flow; never request tokens/codes in chat or store long-lived npm tokens.

Publish the inspected archive, not a rebuilt tree. Verify registry version and integrity before creating authorized tags/releases. Document an immutable Action reference and any separately authorized moving major tag. Never overwrite published versions or tags.

Add an npm README badge only after confirming publication.

## Subsequent Releases

After confirming the first npm release, configure Trusted Publishing in a separate authorized PR. Verify current npm requirements and use GitHub Actions OIDC, not stored tokens.

Before enabling, document workflow/environment restrictions, exact-artifact publication, registry/tag verification, recovery, and any authorized release-only direct-push exception. Development still requires PRs.
