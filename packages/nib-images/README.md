# Nib Images

`@briansunter/nib-images` is the optional static image optimizer for Nib.
Install it alongside `@briansunter/nib`, add `images()` to `nib.config.ts`, and
import local files with `?nib-image`. It produces static responsive `<picture>`
markup; it does not add browser JavaScript.

```ts
import { defineConfig } from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'

export default defineConfig({
  plugins: [images()],
})
```

```tsx
import { Image } from '@briansunter/nib-images'
import hero from './hero.jpg?nib-image'

export default function Page() {
  return <Image src={hero} alt="Mountain trail" layout="full" priority />
}
```

For manual markup or client-enhancement data, call `useImage()` once in a
server-rendered component and reuse the returned resolver inside loops:

```tsx
import { useImage } from '@briansunter/nib-images'
import photo from './photo.jpg?nib-image'

export function PhotoLink() {
  const getImage = useImage()
  const image = getImage({ src: photo, widths: [320, 640, 960] })
  return <a href={image.src} data-srcset={image.srcSet}>View photo</a>
}
```

The result contains the fallback `src`, optional `srcSet` and `sizes`, display
dimensions, modern-format `<source>` data, and a `passthrough` flag. Calling the
resolver registers exactly the transforms that `Image` would register; encoding
still happens in the build finalizer. `useImage()` requires the renderer
provider installed by `images()` and is static-only, not a browser image API.

## Resolve configured content images

JSON collections and Markdown frontmatter often store the public URL already
used by authored HTML. The server-only `/content` entry resolves those URLs to
the same `ImageSource` accepted by `Image` and `useImage`, without a
consumer-owned eager `import.meta.glob` catalog:

```tsx
import { Image } from '@briansunter/nib-images'
import { resolveContentImage } from '@briansunter/nib-images/content'

export function ProjectCover({ cover }: { cover: string }) {
  const source = resolveContentImage(cover)
  return source
    ? <Image src={source} alt="" width={640} />
    : <img src={cover} alt="" />
}
```

`resolveContentImage()` is generated from the existing `images({ content })`
configuration. It accepts the authored public path, such as
`/site-assets/projects/demo.jpg`, and returns `undefined` for an unknown or
invalid path. URL-encoded filenames are decoded safely. Missing configured
directories produce an empty catalog; ambiguous duplicate public paths and
filenames containing URL separators such as `?`, `#`, or `\` fail the build
with both source locations. Unreadable or corrupt candidates emit a warning
and are omitted, preserving the existing unoptimized content fallback.

Encoded path separators (`%2F` and `%5C`), NUL bytes, and double-encoded or
otherwise residual `%` sequences are rejected instead of being treated as an
alias for another file.

The entry is synchronous because its static metadata catalog is generated in
the server Vite graph. Like `Image`, it cannot be imported by an enhancement,
island, or other browser-target module. Nested symlink entries are not followed
by the catalog scan, and every configured content directory must resolve under
`allowedSourceRoots` (the project root by default). The same boundary applies
to development fallback responses and production copies. In development,
nested file creation, updates, and deletion invalidate the generated module so
the server graph rebuilds the catalog.

The component entry is free of Sharp and Node imports. The `/plugin` entry owns
metadata inspection, development middleware, content-addressed caching, and
bounded parallel transforms. `Image` is static-only and cannot be imported by
a browser-target module. Development watches imported sources and re-inspects changed
bytes through HMR; unchanged content keeps its cache key and revalidates with
`304` instead of being encoded again.

`images()` validates options immediately, before Nib starts a Vite graph or
creates a renderer. The build-only package entry is the only supported plugin
authoring path; its internal benchmark utilities are not published as an import.

The content-addressed transform cache targets 10,000 images and 1 GiB by
default. Every transform used by the current build or development session is
protected, so a larger active working set may exceed those soft limits instead
of being evicted and recreated on the next build. Warm builds validate the
encoded byte count and filesystem identity recorded alongside each SHA-256
digest, avoiding a full read of every unchanged image. Use checksum verification
when the cache resides on untrusted or externally mutable storage, or tune the
deterministic least-recently-used cap:

```ts
images({
  cache: {
    maxBytes: 2 * 1024 * 1024 * 1024,
    maxEntries: 20_000,
    verification: 'checksum',
  },
})
```

Rendered `<img>` elements expose only objective source metadata for consumer
styling: `data-nib-orientation` (`landscape`, `portrait`, or `square`) plus
`--nib-image-source-width`, `--nib-image-source-height`, and
`--nib-image-source-aspect`. Orientation compares the intrinsic width and
height directly. Nib does not choose a visual comfort width or other
site-specific sizing policy.

Rendered content images can opt into the same optimizer without importing each
file in a component. Configure a project-relative source directory and its
public URL prefix; only matching `<img>` references in the completed HTML are
rewritten, and the source catalog still owns metadata and cache identity.
In development, the same configured image roots are served at their authored
public paths (including a configured base path), so content-image pages do not
fall back to broken source URLs before the production rewrite runs. Symlinks
that escape the configured directory are rejected.

Use `data-nib-width` when the image's layout slot is smaller than its source
file. It controls the emitted intrinsic `width`/`height`; `data-nib-widths`
remains the responsive candidate ladder and is capped at roughly 2x the
display width. If `data-nib-width` is omitted, the existing behavior uses the
largest `data-nib-widths` value for both.

For component images, an explicit `widths` array is the complete authored
candidate ladder: Nib filters it to usable source/layout bounds but does not
silently append the intrinsic or display width. When every authored width is
outside those bounds, Nib emits one bounded fallback candidate.

```ts
images({
  content: [{
    publicPath: '/media/',
    directory: 'src/assets/media',
    widths: [320, 640, 1280],
    sizes: '(min-width: 900px) 860px, 100vw',
  }],
})
```

```html
<img
  src="/media/photo.jpg"
  alt="A small gallery photo"
  width="504"
  data-nib-width="504"
  data-nib-widths="240, 320, 480, 640, 960"
  sizes="(min-width: 1072px) 31.5rem, (min-width: 640px) calc(50vw - 2rem), calc(50vw - 1.25rem)"
>
```

`@briansunter/nib-images` is a separate Bun workspace package. It is built and
tested from the repository root, but Release Please versions and publishes it
independently from `@briansunter/nib` when files in this package change.
