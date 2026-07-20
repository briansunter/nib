# Nib Images

`@briansunter/nib-images` is the optional static image optimizer for Nib.
Install it alongside `@briansunter/nib`, add `images()` to `nib.config.ts`, and
import local files with `?nib-image`. It produces static responsive `<picture>`
markup; it does not add hydration JavaScript.

```ts
import { defineConfig } from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'

export default defineConfig({
  site: { title: 'My site' },
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

The component entry is free of Sharp and Node imports. The `/plugin` entry owns
metadata inspection, development middleware, content-addressed caching, and
bounded parallel transforms. `Image` is static-only and cannot be used inside
a React island. Development watches imported sources and re-inspects changed
bytes through HMR; unchanged content keeps its cache key and revalidates with
`304` instead of being encoded again.

`images()` validates options immediately, before Nib starts a Vite graph or
creates a renderer. The build-only package entry is the only supported plugin
authoring path; its internal benchmark utilities are not published as an import.

Rendered content images can opt into the same optimizer without importing each
file in a component. Configure a project-relative source directory and its
public URL prefix; only matching `<img>` references in the completed HTML are
rewritten, and the source catalog still owns metadata and cache identity.

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

`@briansunter/nib-images` is a separate Bun workspace package. It is built and
tested from the repository root, but Release Please versions and publishes it
independently from `@briansunter/nib` when files in this package change.
