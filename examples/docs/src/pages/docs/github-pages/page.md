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

GitHub project sites are served below `/<repository>/`, not `/`. In Actions, Nib reads `GITHUB_REPOSITORY` and configures Vite with `/nib/` for this repository. That keeps assets, internal links, and dynamically imported island chunks working at the deployed URL.

Internal links in TSX should use `siteHref`:

```tsx
import { siteHref } from '@briansunter/nib'

<a href={siteHref('/docs/')}>Documentation</a>
```

For a user site or custom domain, set `SITE_BASE_PATH=/` in the workflow environment. For another subpath, include leading and trailing slashes, such as `SITE_BASE_PATH=/docs/`.

## Output

The build produces one `index.html` per known route, a `404.html` fallback, CSS, assets, and JavaScript only for routes with React islands. GitHub Pages needs only `dist/client`; no production Node server is required.
