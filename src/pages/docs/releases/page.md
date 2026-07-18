---
title: Releases
description: Validate and publish Nib with Release Please.
layout: docs
---

# Releases

Nib uses Release Please to turn Conventional Commits on `master` into release pull requests. Merging a release pull request updates the version and changelog, creates the Git tag and GitHub release, and publishes the package from that exact tag.

## Commit format

```text
feat: add a docs page          # minor 0.x release
fix: correct project links     # patch 0.x release
docs: clarify deployment
chore: update dependencies
```

Use `feat:` for user-facing features and `fix:` for bug fixes. Release Please uses the commit type to calculate the next version.

## Version policy

Nib accepts patch and minor `0.x.y` versions but does not publish major versions. The policy is enforced by:

```bash
bun run check:version-policy
```

The check runs in both the Pages CI and npm release workflow. It rejects versions such as `1.0.0` while allowing `0.1.1` and `0.2.0`.

## Local checks

```bash
bun run check:version-policy
bun run typecheck
bun run test
bun run build
bun pm pack --destination ./dist/package
```

The package is [`@briansunter/nib`](https://www.npmjs.com/package/@briansunter/nib). The unscoped `nib` name is already registered, so Nib uses the public `@briansunter` scope.

## npm authentication

The first publish is a one-time bootstrap from an authenticated maintainer machine:

```bash
npm publish --access public
```

After the package exists, configure its npm trusted publisher with:

```text
owner:    briansunter
repo:     nib
workflow: release.yml
```

The release workflow uses Bun for installation and validation, then npm with GitHub Actions OIDC for `npm publish --provenance`. It does not require a BWS or long-lived npm token.
