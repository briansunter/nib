---
title: Releases
description: Version and publish Mini Static with Release Please.
layout: docs
---

# Releases

Release Please turns Conventional Commits on `master` into release pull requests. Merging a release pull request updates the version and changelog, creates a Git tag and GitHub release, and publishes the package to npm.

## Commit format

Use a release-aware prefix:

```text
feat: add a docs page
fix: correct project-page links
docs: clarify deployment
chore: update dependencies
```

`feat` and `fix` are the most common release-triggering types. Documentation and maintenance commits keep the changelog useful even when they do not require a package release.

## Local checks

```bash
bun run typecheck
bun run test
bun run build
bun pm pack --destination ./dist/package
```

The GitHub Actions workflow publishes `mini-static` from the exact release tag after these checks pass.

## npm authentication

The release workflow uses npm trusted publishing with GitHub Actions OIDC. It does not require a BWS or npm token. Configure the `mini-static` package's trusted publisher with owner `briansunter`, repository `nib`, and workflow filename `release.yml`.

Bun does not currently expose npm provenance publishing, so Bun handles installation and validation while npm performs the final `npm publish --provenance` step. The workflow grants only the short-lived `id-token: write` permission needed for OIDC.
