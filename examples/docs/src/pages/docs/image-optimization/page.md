---
title: Image optimization
description: Generate static responsive local images with the optional Nib image plugin.
layout: docs
---

# Image optimization

`@briansunter/nib-images` is an optional build-time package. It creates static
responsive image markup and files; it does not add a client runtime or turn an
image into a React island.

Install it:

```bash
npm install @briansunter/nib-images
```

Register the plugin in `nib.config.ts`:

```ts
import { defineConfig } from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'

export default defineConfig({
  site: { title: 'Example' },
  plugins: [images({ formats: ['avif', 'webp'] })],
})
```

Import a local image with the explicit query and render it with `Image`:

```tsx
import { Image } from '@briansunter/nib-images'
import hero from './hero.jpg?nib-image'

export default function Page() {
  return <Image src={hero} alt="Hikers on a ridge" layout="full" priority />
}
```

`Image` reads width and height from the import, including EXIF orientation. It
emits AVIF and WebP `<source>` elements plus JPEG (or PNG for alpha) fallback
markup. Standard images use `loading="lazy"` and `decoding="async"`; `priority`
uses eager loading and a high fetch priority.

`quality` applies to AVIF, WebP, and JPEG. PNG fallback output stays lossless
and uses a fixed compression setting, so a misleading PNG quality control is
not exposed.

## Layouts and `sizes`

| Layout | Use | Default sizes |
| --- | --- | --- |
| `constrained` | A responsive image with a known maximum width | `(max-width: Wpx) 100vw, Wpx` |
| `fixed` | An icon or fixed-size image | Density descriptors, no `sizes` |
| `full` | An image spanning its container | `100vw` |

Use an explicit `sizes` value when CSS places an image in a multi-column
layout. Nib cannot infer arbitrary container widths. `widths` replaces the
configured responsive ladder, while `fixed` uses `densities` instead.

## Cache and limits

Transformed files are content-addressed in `.nib/cache/images` and linked or
copied to `dist/client/assets/nib`. Deleting `dist` is safe; a warm build reuses
checksum-validated cache entries. `concurrency` bounds all active Sharp
transforms, while `memoryLimitMb` can lower that bound using a conservative
per-transform estimate for CI. The automatic value respects both available
processors and Node's libuv image-task concurrency. Nib maintainers can run
`bun run benchmark:images` to compare cold, warm, concurrency, memory, and
WebP-only versus AVIF-plus-WebP behavior on the current machine.

In development, every imported image is watched explicitly. Changed bytes are
re-inspected without restarting the server and receive a new ETag; touching or
byte-identically rewriting a file keeps the same key and returns `304` without
re-encoding. Short editor overwrite windows are retried instead of discarding
the last valid source.

The root component entry is processor-free. Import `images()` from the
`/plugin` entry as shown above. `Image` is a static rendering primitive and
cannot be imported into a React island; build and development report that
mistake instead of shipping build paths or failing during hydration.

Only local JPEG, PNG, WebP, and AVIF sources are transformed in this release.
SVG and animated sources are passed through without rasterization or animation
conversion. Remote URLs and automatic Markdown image rewriting are not yet
supported.
