# Personal site shape, rebuilt with Nib

This is a bounded proof of how much of `../personal-site` maps cleanly onto
the published Nib `0.12.0` framework and `0.3.0` image package. It deliberately uses the target site's Inter/Lora fonts, warm editorial
palette, avatar, project artwork, and a small sample of its art and travel
photos. It is not a second copy of the complete 648-image, 320-recipe site.

## Run it

From this directory:

```bash
bun install
bun run verify
bun run dev
```

The example consumes the published packages directly, so this verifies the
release artifact rather than a checked-out workspace link.

The deployable output is `dist/client`.
The target Astro site uses no trailing slashes, and this proof now publishes
matching extensionless artifacts where the route is a leaf. Nib preview
redirects slash-form requests to the canonical extensionless URL; deployments
need a host that serves extensionless page files as HTML and rewrites a parent
route to its directory index.

## View the running proof

The persistent local preview listens on loopback and is forwarded through
Tailscale Serve:

- This Mac: <http://127.0.0.1:5173/>
- Any device on the tailnet: <https://macmini.taild80340.ts.net:8447/>

Use the Tailscale URL from another device; `localhost` there refers to that
device, not this Mac. The loopback-only listener is intentional, so the dev
server is not exposed directly on the LAN. The configured LaunchAgent keeps it
running as `com.briansunter.nib-personal-site`; inspect it with
`launchctl print gui/$(id -u)/com.briansunter.nib-personal-site` and inspect the
proxy with `tailscale serve status`.

## What is proved

| Target-site feature | Nib proof |
| --- | --- |
| Editorial homepage and shared header/footer | `src/pages/page.tsx`, `src/site-shell.tsx`, and plain CSS |
| Markdown writing pages and layouts | `src/pages/notes/*/page.md` with `src/layouts/article.tsx` |
| Typed content collections | YAML collections in `src/content/posts` and `fromPageSource(projectPages)` |
| Generated project detail pages | `definePageSource` plus `pageRenderer('./src/data-pages', 'ProjectDetailPage')` turns project YAML into routes without preloading image transforms in config |
| Responsive local images | `?nib-image` imports plus `Image` in home, project index, art, and photos |
| Lazy/eager loading and intrinsic dimensions | image props and `scripts/check-performance.mjs` assertions |
| RSS and sitemap | first-party `rss()` and `sitemap()` plugins in `nib.config.ts` |
| Browser-only interaction | `ThemeToggle`, `Search`, and recipe serving scaler islands |
| Tags, redirects, 404, privacy, and external links | representative static routes/configuration |

The performance script checks that the built homepage contains responsive
`<picture>` markup, AVIF/WebP candidates, lazy and priority images, and that a
Markdown route has no island runtime. It also checks the generated RSS feed.

## What was not easy or not possible in this pass

- The target uses Astro content loaders for hundreds of Markdown/MDX pages,
  YAML photo/art collections, and a custom Cooklang parser. Nib can support
  these through typed collections or a page-source plugin, but there is no
  built-in Cooklang loader, so porting all 320 recipes would be a separate
  adapter rather than a mechanical move.
- Nib's image optimizer intentionally requires explicit local raster imports
  with `?nib-image`. The target rewrites many Obsidian/Markdown image embeds
  and has a large asset catalog. Those images need an import/catalog step;
  automatic Markdown image optimization and remote images are not part of the
  current package.
- The target's generated Satori OG PNG routes, Pagefind search index, Leaflet
  travel map, PhotoSwipe lightbox, EXIF/photo metadata, and full gallery
  masonry are not reproduced here. Islands can cover the browser interactions,
  but the build-time OG/image-index/map integrations need dedicated plugins or
  app-owned build steps.
- Nib does not expose a general typed document-head mutation seam. The target's
  preload/structured-schema/alternate-markdown work would need explicit page
  markup or a future document-contribution plugin. The proof uses image
  `priority` and route metadata instead.
- The newsletter form remains an external-service handoff. No network signup,
  authentication, analytics, or production console was exercised.

The strongest clean result is the static publishing core: shared page chrome,
Markdown, typed YAML data, route generation, RSS/sitemap, and build-time
responsive images all work in one small Nib project. The main friction is
porting the target's specialized content and browser integrations, not the
editorial site shape itself.
