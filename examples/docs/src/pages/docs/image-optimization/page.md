---
title: Image optimization
description: Generate static responsive local images with the optional Nib image plugin.
layout: docs
---

# Image optimization

`@briansunter/nib-images` is an optional build-time package. It creates static
responsive image markup and files; it does not add a client runtime or turn an
image into a React island.

Install it with Sharp:

```bash
npm install @briansunter/nib-images sharp
```

Register the plugin in `nib.config.ts`:

```ts
import { defineConfig } from '@briansunter/nib'
import { images } from '@briansunter/nib-images'

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
unchanged cache entries. `concurrency` bounds active source transforms and can
be tuned for CI. Nib maintainers can run `bun run benchmark:images` to measure
the cold and warm cache path on the current machine.

Only local JPEG, PNG, WebP, and AVIF sources are transformed in this release.
SVG and animated sources are passed through without rasterization or animation
conversion. Remote URLs and automatic Markdown image rewriting are not yet
supported.
