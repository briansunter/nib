# Personal site replicated with Nib

This example ports the current content and public asset surface of
`../personal-site` into the workspace Nib framework and image package. The
example intentionally consumes the sibling workspace packages so framework
changes are exercised before publication.

The generated snapshot currently contains:

- 62 root-level writing routes, including nested newsletter routes
- 58 project detail routes
- 320 Cooklang recipe detail routes
- 496 tag detail routes
- 25 artworks, 158 photos, 131 pins, and 79 travel cities
- the source site's public files, 648 image assets, 16 videos, RSS, sitemap,
  and `/llms.txt`

## Run it

From this directory:

```bash
bun install
bun run verify
bun run dev
```

The committed/generated snapshot is what the build consumes. To refresh it
from the sibling Astro site:

```bash
PERSONAL_SITE_SRC=../personal-site bun run import:content
```

`dist/client` is the deployable static output. The site keeps the original
extensionless URL policy (`trailingSlash: 'never'`); Nib emits extensionless
page artifacts and redirect documents for `/notes` → `/pages` and
`/rss.xml` → `/index.xml`. A deployment host must serve those extensionless
files as HTML and handle both slash and non-slash requests at its edge.

## View the running proof

The persistent local preview listens on loopback and is forwarded through
Tailscale Serve:

- This Mac: <http://127.0.0.1:5173/>
- Any device on the tailnet: <https://macmini.taild80340.ts.net:8447/>

Use the Tailscale URL from another device; `localhost` there refers to that
device, not this Mac. The configured LaunchAgent keeps it running as
`com.briansunter.nib-personal-site`; inspect it with
`launchctl print gui/$(id -u)/com.briansunter.nib-personal-site` and inspect the
proxy with `tailscale serve status`.

## What is covered

The replica uses pattern-discovered Nib page sources for project, recipe, and
tag detail routes;
typed collections for the imported JSON snapshots; the article Markdown
layout for writing; first-party RSS and sitemap plugins; responsive
`?nib-image` imports for the avatar, homepage writing covers, and featured
project covers plus reference-driven optimization for content images; and
scoped client behaviors for theme switching, search, recipe filtering, recipe
serving scaling, and copying the Bitcoin address. The first-party
`clientNavigation()` plugin owns same-origin document swaps, history,
prefetching, focus/scroll restoration, and runtime remounting; the replica has
no app-owned router or Astro lifecycle compatibility layer.

Writing pages preserve local images, YouTube/Google Maps iframe embeds, and
local MP4 embeds through Nib's allow-listed media adapter. Homepage writing
and featured project covers are optimized by `nib-images`; the source image
catalog lives under `src/assets/site-assets`, and only referenced content
images are emitted into the deployable output. Gallery pages (photos, art,
pin-collection) annotate each `<img>` with both `data-nib-width` and
`data-nib-widths`: the first matches the actual CSS slot (`1024px` featured,
`504px` photo card, `332px` art cell, `180px` pin), while the second keeps a
small responsive ladder rather than shipping every source at its natural
`1200px` width.

`bun run check:performance` verifies the built homepage's picture/srcset,
AVIF/WebP, lazy/priority image output, RSS items, extensionless internal
links, route accessibility basics, local media references, and the fact that
a static Markdown article does not ship island runtime code. It also asserts
the `/photos`, `/art`, and `/pin-collection` routes ship optimized `<picture>`
markup with per-use responsive candidate ladders (authored via the
`data-nib-width` and `data-nib-widths` hints), slot-sized intrinsic
width/height dimensions, and authored `sizes`, and that the RSS feed mirrors
the original Astro `index.xml`:
stylesheet processing instruction, atom/content/dc namespaces, channel
language/copyright/managingEditor/webMaster, per-item `dc:creator`, and
project cover images embedded in `content:encoded`.

## Known differences

These parts of the Astro site are represented by accessible static fallbacks
rather than copied wholesale:

- Leaflet travel maps, PhotoSwipe galleries, and the original Pagefind runtime
- Satori-generated per-page OG images (the Nib metadata plugin still emits
  canonical, Open Graph, Twitter, and WebPage metadata)
- the original custom Cooklang parser's full unit/scaling behavior; the
  adapter parses the source into typed ingredients, cookware, sections,
  timings, nutrition metadata, and preserves the original source text
- fetched X/Twitter embeds and bespoke MDX/JSX widgets
- external newsletter signup, analytics, and other production services
- RSS cover images are resized by Nib's normal page-image pipeline only when
  they are rendered as pages; feed content currently embeds the canonical
  source URL rather than the Astro webp@1200 derivative.

Those are the boundaries that required app-owned adapters or integrations;
the static publishing, content, route, image, feed, and basic interaction
surface is exercised in the replica.
