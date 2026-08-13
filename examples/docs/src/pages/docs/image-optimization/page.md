---
title: Image optimization
description: Generate static responsive local images with the optional Nib image plugin.
layout: docs
---

# Image optimization

`@briansunter/nib-images` is an optional build-time package. It creates static
responsive image markup and files; it does not add a client runtime.

Install it:

```bash
npm install @briansunter/nib-images
```

Register the plugin in `nib.config.ts`:

```ts
import { defineConfig } from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'

export default defineConfig({
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

Use `useImage()` when a component needs the resolved URLs without delegating
markup to `Image`, such as a gallery that serializes candidates for a scoped
client enhancement:

```tsx
import { useImage } from '@briansunter/nib-images'
import photo from './photo.jpg?nib-image'

export function GalleryItem() {
  const getImage = useImage()
  const image = getImage({
    src: photo,
    layout: 'constrained',
    widths: [320, 640, 960],
    sizes: '(min-width: 48rem) 50vw, 100vw',
  })
  return <a href={image.src} data-sources={JSON.stringify(image.sources)}>Open</a>
}
```

Call the hook once during a server-rendered component, then call its stable
`getImage` function freely inside maps or loops. It registers the same build
transforms as `Image` and returns `src`, optional `srcSet`/`sizes`, intrinsic
`width`/`height`, modern-format `sources`, and `passthrough`. It does not encode
bytes immediately and is not a browser image service; the images plugin must
wrap the Nib renderer and finalizes every registered candidate into static
output.

## Resolve paths stored in content

When a JSON collection or Markdown field already stores a configured public
path, use the server-only content resolver instead of maintaining an eager
`import.meta.glob` lookup in the application:

```tsx
import { Image } from '@briansunter/nib-images'
import { resolveContentImage } from '@briansunter/nib-images/content'

export function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const source = resolveContentImage(src)
  if (!source) return <img src={src} alt={alt} />
  return <Image src={source} alt={alt} layout="constrained" width={640} />
}
```

The resolver catalog comes directly from every `images({ content: [...] })`
`publicPath` and `directory` pair. It returns `undefined` for unknown or unsafe
paths. Overlapping content roots may coexist, but the build rejects two files
that claim the same public path rather than silently choosing one. This import
belongs only in server-rendered pages, layouts, and components; browser-target
enhancements and islands reject it. Corrupt candidates warn and resolve as
`undefined`, matching the content optimizer's unoptimized fallback behavior.

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
cannot be imported into a client enhancement or React island; build and
development report that
mistake instead of shipping build-only image processing code to the browser.

For imported content or Markdown that already uses stable public image URLs,
configure an opt-in source root. Nib copies the originals to that public prefix
for lightboxes and fallbacks, then rewrites matching rendered `<img>` elements
to the same responsive `<picture>` pipeline:

```ts
images({
  content: [{
    publicPath: '/site-assets/',
    directory: 'src/assets/site-assets',
    widths: [320, 640, 1280],
    sizes: '(min-width: 900px) 860px, 100vw',
  }],
})
```

This is deliberately reference-driven rather than a scan of every file in the
project. Animated, SVG, or unsupported/corrupt sources remain available at
their original URL and do not abort the rest of the build.

Only local JPEG, PNG, WebP, and AVIF sources are transformed in this release.
SVG and animated sources are passed through without rasterization or animation
conversion. Remote URLs and automatic relative-path Markdown image resolution
are not yet supported.
