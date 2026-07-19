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

`@briansunter/nib-images` is a separate Bun workspace package. It is built and
tested from the repository root, but Release Please versions and publishes it
independently from `@briansunter/nib` when files in this package change.
