---
title: GitHub Pages
description: Build and deploy the generated docs site with GitHub Actions.
layout: docs
---

# GitHub Pages

The `.github/workflows/pages.yml` workflow runs the same checks used locally for pull requests. Pushes to `master` also upload `dist/client` and deploy it to GitHub Pages.

## One-time setup

1. Open the repository's **Settings → Pages** page.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `master` or run the workflow manually from the Actions tab.

The workflow derives the Vite base path from `GITHUB_REPOSITORY`. A project site is therefore served correctly below `/<repository>/`, including its assets and navigation. Local builds use `/` by default.

For a user Pages site or a custom domain, set `SITE_BASE_PATH=/` in the workflow or build environment.

## Output

The build produces one `index.html` per known route, a custom `404.html`, CSS, and the hydrated client bundle. No production Node server is required by GitHub Pages.
