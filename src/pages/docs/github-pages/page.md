---
title: GitHub Pages
description: Build and deploy a Nib site with GitHub Actions.
layout: docs
---

# GitHub Pages

Nib includes `.github/workflows/pages.yml`. Pull requests run the checks and production build; pushes to `master` deploy `dist/client` to GitHub Pages.

## One-time setup

1. Open the repository’s **Settings → Pages** page.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `master`, or run the workflow manually from the Actions tab.

The example site is live at <https://briansunter.github.io/nib/>.

## Project-site base paths

GitHub project sites are served below `/<repository>/`, not `/`. In Actions, Vite reads `GITHUB_REPOSITORY` and automatically builds this repository with `/nib/` as its base path. That keeps assets, links, and dynamically imported island chunks working at the deployed URL.

Internal links in React pages should use `siteHref`:

```tsx
import { siteHref } from '../../framework/urls'

<a href={siteHref('/docs/')}>Documentation</a>
```

For a user site or custom domain, set `SITE_BASE_PATH=/` in the workflow environment before `bun run build`.

## Output

The build produces one `index.html` per known route, a `404.html` fallback, CSS, JavaScript, and assets in `dist/client`. GitHub Pages needs only that directory; no production Node server is required.
