# Releasing

## Status

Provisional instructions only. The project is not released, and no release automation, trusted publisher, credentials, or tags are configured. These instructions do not authorize any release action.

## Version and Validation

Check npm for the current version before bumping. An unreleased `0.1.0` remains `0.1.0`. Apply the version policy in [Agent Instructions](AGENTS.md), keeping `package.json`, `package-lock.json`, and the Next changelog heading synchronized.

Before publication, validate the exact revision with `npm run test:coverage`, `npm run lint`, and `npm run package:check`. Confirm the committed Action bundle matches `npm run build`. Build and inspect a retained tarball with `npm pack --json`; verify its contents and install that exact archive into an isolated consumer with strict engine checks, exercising the real CLI and Action rather than mocks.

## First Publication

Plan a manual first npm release at `0.1.0` only after implementation and explicit user authorization. Authenticate interactively through npm's supported login flow; never request tokens or authentication codes in chat, or store long-lived npm tokens in repository secrets.

Publish the inspected archive, not a newly rebuilt source tree. Verify the explicit registry version and archive integrity, then create the matching release tag and GitHub Release only with authorization. Never overwrite published versions or existing tags. The first release must establish and document an immutable Action reference and any separately authorized moving major tag.

After confirming publication, add an npm version badge to README linking to the actual published package. Do not add a registry badge before publication.

## Subsequent Releases

Only after the first version exists in npm, configure npm Trusted Publishing in a focused, authorized PR. Verify current npm requirements and use GitHub Actions OIDC instead of stored npm tokens. Publisher setup, authentication, workflow dispatch, publication, and tags/releases require separate explicit authorization.

Document the implemented workflow, environment restrictions, exact-artifact publication, registry/tag verification, recovery, and any authorized release-only direct-push exception before enabling it. Until that setup exists, ordinary development requires PRs and no direct default-branch pushes.
