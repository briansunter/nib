# Type-safe plugins and image optimization

Status: Implemented and performance-audited

This document is the design and implementation record for the current generic
plugin API and optional local-image optimizer. The non-goals remain deliberate:
remote images, Markdown rewriting, SVG rasterization, and animated-image
conversion are follow-up work.

The plugin interface was subsequently extended with typed page-source setup,
virtual route providers, and immutable resolved-route inspection. The additive
contract and current ordering rules are documented in
[Plugin content and routing](./plugin-content-and-routing.md); the original
Vite/renderer design below remains the rationale for those hooks.

## Audit corrections

The July 2026 implementation audit found and corrected several first-pass
inconsistencies:

- the component entry pulled in the Sharp-backed plugin despite the documented
  package boundary;
- a one-source build launched every width/format transform at once, bypassing
  configured concurrency;
- fixed custom densities were labeled by array position and emitted `w`
  descriptors instead of their real `x` density;
- fixed and constrained `width` values did not control intrinsic layout
  dimensions consistently;
- plugin Vite instances were reused across client and server builds;
- cache keys omitted the Sharp/libvips and encoder configuration, non-empty
  corruption was trusted, and source-root checks allowed symlink escapes;
- the public placeholder option was accepted but did nothing.

The current implementation and validation matrix cover these cases directly.

## Decision

Add a small, type-safe plugin interface to Nib and implement image optimization
in a separate optional package:

- `@briansunter/nib` owns plugin ordering, Vite integration, render wrapping,
  build finalization, and error attribution.
- `@briansunter/nib-images` owns the static React `Image` component, local image
  metadata, responsive candidate selection, caching, and image transformation.
- Sharp is a dependency of the image plugin package, not Nib.
- The generated image markup is static `<picture>` and `<img>` HTML. It is not
  an island and adds no browser JavaScript.

The component and plugin are complementary. A component alone cannot emit
files, persist a build cache, install development middleware, or coordinate
work across routes. A Vite plugin alone cannot see the final component props
that determine layout, widths, formats, quality, and loading behavior.

The public authoring model should be:

```tsx
import { Image } from '@briansunter/nib-images'
import hero from './hero.jpg?nib-image'

export default function Home() {
  return (
    <Image
      src={hero}
      alt="A trail crossing a mountain ridge"
      layout="full"
      sizes="100vw"
      priority
    />
  )
}
```

```ts
import { defineConfig } from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'

export default defineConfig({
  plugins: [
    images({
      formats: ['avif', 'webp'],
      widths: [320, 480, 640, 960, 1280, 1600, 1920],
      cacheDirectory: '.nib/cache/images',
    }),
  ],
  site: {
    title: 'My site',
  },
})
```

## Goals

- Let third-party packages extend Nib without editing the framework-owned Vite
  configuration or renderer.
- Preserve concrete plugin tuples and option inference through `defineConfig`.
- Give plugins typed Vite, render, page, and build-finalization contexts.
- Keep the normal Nib path unchanged when no plugins are configured.
- Let a plugin collect work while every route renders, deduplicate it globally,
  and finish asynchronous work before HTML is written.
- Generate correctly dimensioned responsive images from local imports.
- Produce AVIF, WebP, and a safe fallback format with native browser selection.
- Prevent layout shift by deriving oriented intrinsic dimensions from the
  source.
- Default non-priority images to native lazy loading and asynchronous decoding.
- Reuse unchanged outputs across builds with a content-addressed disk cache.
- Bound concurrency by CPU and memory instead of starting every transform at
  once.
- Preserve Nib base paths in every generated image URL.
- Make development, production build, preview, and packed-package consumption
  behave consistently.

## Non-goals

- A runtime image optimization server in deployed Nib sites.
- Client-side resizing or format conversion.
- Automatically inferring arbitrary CSS layout or container widths.
- Optimizing untrusted remote URLs in the first release.
- Rewriting every ordinary HTML `img` element automatically.
- Rasterizing SVG or transforming animated images by default.
- Adding a second hydration runtime or requiring React in the browser.
- Making the first plugin API cover every possible bundler or deployment
  adapter.

## Architecture constraints

Before this implementation, Nib:

- hardcoded its Vite plugin list in `siteViteConfig`;
- loads the consumer configuration once to create the Vite configuration and
  again inside the generated server entry;
- renders pages synchronously through `ProjectRenderer.render`;
- writes routes one at a time immediately after rendering;
- owns the HTML document instead of using a normal Vite `index.html` entry;
- includes only the island client entry and stylesheet in the client build
  graph;
- treats `dist/server` as an intermediate and deploys only `dist/client`.

These constraints rule out three tempting implementations:

1. Do not depend on shared memory between a plugin instance created while
   loading `nib.config.ts` and another instance bundled into the server entry.
   They are separate instances.
2. Do not emit optimized page images only from the server Vite build. Those
   assets would land under `dist/server`, which is not deployed.
3. Do not rely on Vite's `transformIndexHtml` hook. Nib uses custom document
   rendering and must call its own typed page/build hooks.

The durable bridge is an explicit `ProjectRenderer.finalize()` method exported
from the server entry. It runs after all routes have registered their work and
receives the deployable client output directory.

## Package boundaries

### `@briansunter/nib`

Add an advanced plugin-author entry point:

```text
@briansunter/nib
@briansunter/nib/plugin
@briansunter/nib/internal/client
@briansunter/nib/internal/server
```

The root entry exposes site-authoring APIs only. The `/plugin` entry is the
plugin-author seam: it exposes plugin contracts and `definePlugin`. Runtime implementation
details remain under the existing internal entries.

### `@briansunter/nib-images`

Use a separate package:

```text
@briansunter/nib-images          Image component and public image types
@briansunter/nib-images/plugin   images() and Sharp-backed build integration
```

The root entry must not import Sharp or Node APIs. The `/plugin` entry is
server/build-only and may depend on Sharp, filesystem APIs, and Vite types.
Pages are server-rendered, but keeping this split prevents an accidental image
processor import from reaching an island or other client graph.

Build both package entries together so the component and plugin reference one
shared image-context module. React remains a peer dependency and must not be
bundled. A packed-package test must catch duplicated React or duplicated
context modules, which would make a configured provider look missing to the
component.

The plugin package may initially live beside Nib in the same repository for
contract and packed-consumer testing. It must retain an independent package
manifest and release version so installing Nib does not install Sharp.

The image plugin factory should have a concrete, readonly option contract:

```ts
import type { NibPlugin } from '@briansunter/nib/plugin'

export interface ImagesOptions {
  readonly formats?: readonly ('avif' | 'webp')[]
  readonly widths?: readonly number[]
  readonly quality?:
    | number
    | Readonly<Partial<Record<'avif' | 'webp' | 'jpeg', number>>>
  readonly cacheDirectory?: string
  readonly concurrency?: 'auto' | number
  readonly memoryLimitMb?: number
  readonly allowedSourceRoots?: readonly string[]
}

export function images<const Options extends ImagesOptions>(
  options?: Options,
): NibPlugin
```

The factory preserves literal option values for callers and validates all
runtime values before returning work to Nib. `allowedSourceRoots` defaults to
the project root. Remote URLs remain unsupported rather than being accepted
through an overly broad string source type.

## Generic Nib plugin contract

Put public contracts in a dedicated framework module and re-export them through
`@briansunter/nib/plugin`.

```ts
import type { ReactNode } from 'react'
import type { PluginOption } from 'vite'

export type NibCommand = 'build' | 'serve'
export type NibMode = 'development' | 'production'
export type Awaitable<Value> = Value | Promise<Value>

export interface NibVitePluginContext {
  readonly command: NibCommand
  readonly mode: NibMode
  readonly target: 'client' | 'server' | 'development'
  readonly root: string
  readonly base: string
  readonly configPath: string
}

export interface NibRendererPluginContext {
  readonly command: NibCommand
  readonly mode: NibMode
  readonly root: string
  readonly base: string
  readonly site: NibPluginSiteConfig
}

export interface NibRenderPageContext {
  readonly command: NibCommand
  readonly route: NibPluginRoute
  readonly root: string
  readonly base: string
  readonly mode: NibMode
}

export interface NibFinalizeContext extends NibRendererPluginContext {
  readonly clientDirectory: string
  readonly renderedPaths: readonly string[]
}

export interface NibRendererExtension {
  wrapPage?(
    page: ReactNode,
    context: NibRenderPageContext,
  ): ReactNode

  transformPage?(
    page: NibRenderedPage,
    context: NibRenderPageContext,
  ): NibRenderedPage

  finalize?(context: NibFinalizeContext): Promise<void>
}

export interface NibPlugin {
  readonly name: string

  vite?(
    context: NibVitePluginContext,
  ): Awaitable<PluginOption>

  renderer?(
    context: NibRendererPluginContext,
  ): Awaitable<NibRendererExtension | void>
}

export function definePlugin<const Plugin extends NibPlugin>(
  plugin: Plugin,
): Plugin {
  return plugin
}
```

`definePlugin` is an identity helper. Its purpose is contextual typing for hook
parameters and preservation of a plugin factory's concrete return type. Plugin
factories may still use their own generic option types:

```ts
interface SitemapOptions {
  includeDrafts?: boolean
}

export function sitemap<const Options extends SitemapOptions>(
  options: Options = {} as Options,
) {
  return definePlugin({
    name: '@example/nib-sitemap',
    renderer(context) {
      // context and the returned extension are typed.
      return {
        async finalize(output) {
          // options retains its concrete inferred type.
        },
      }
    },
  })
}
```

Apps can add styling and other Vite-only adapters without creating a Nib plugin.
The contribution factory runs once for each Vite graph, so adapters do not
accidentally share client, server, and development state:

```ts
export type NibViteConfig = (
  context: NibVitePluginContext,
) => Awaitable<PluginOption>
```

Do not make `NibConfig` generic only to retain the plugin tuple. The existing
const generic on `defineConfig` already preserves the concrete configuration:

```ts
export interface NibConfig {
  base?: string
  site: SiteConfig
  vite?: NibViteConfig
  plugins?: readonly NibPlugin[]
  // Existing fields remain unchanged.
}
```

This avoids disturbing `PageProps<typeof config>` and the current collection
inference. `NibConfig.vite` is deliberately narrower than a Vite `UserConfig`:
it accepts only plugin contributions. Use it for application-owned integrations
such as `vite: () => tailwindcss()`. Use `plugins` for package capabilities
that also need Nib renderer or build lifecycle hooks, such as image processing.

### Hook rules

- Plugin names must be non-empty and unique within a configuration.
- `NibConfig.vite` is optional and, when present, must be a factory that
  returns a Vite `PluginOption`; it receives the same immutable graph context
  as package plugin Vite hooks.
- `vite` and `renderer` are optional functions; other hook-shaped values fail
  configuration validation.
- Vite contributions are resolved in config order. Vite's own `enforce`
  semantics still determine pre/post placement.
- Client and server production builds receive fresh contributed plugin
  instances, identified by `context.target`; development uses the
  `development` target and Vite's environment-aware hook context.
- Recursive Vite `PluginOption` arrays and promises are fully awaited without
  changing their declared order.
- Renderer extensions are created once, in config order, for each server
  renderer.
- `wrapPage` is synchronous. The first configured plugin is the outermost
  wrapper, making composition deterministic.
- `transformPage` runs synchronously in config order after React rendering.
- Transform inputs contain only status, head, and HTML. Nib retains hydration
  ownership, and verifies that each plugin leaves every rendered island element
  byte-for-byte intact. A transform may change ordinary static HTML but cannot
  invent, remove, reorder, or alter hydration boundaries after React rendering.
- `finalize` runs asynchronously in config order after every production route
  and the 404 page have rendered.
- Arbitrary plugin finalizers are not run in parallel because ordering may be
  meaningful. Each plugin can parallelize its own independent work.
- `finalize` is called once in production and never during development request
  rendering.
- Calling `finalize` twice, rendering after finalization, or returning a
  malformed page produces an attributed framework error.
- Errors include the plugin name, hook name, route when applicable, original
  message, and original error cause.

### Why render hooks stay synchronous

React's current static renderer is synchronous, and pages, layouts, the shell,
and island collection already depend on deterministic repeated renders.
Changing `render(url)` to return a promise would spread through the development
middleware, server-entry contract, tests, and consumers without helping the
image pipeline.

Image transformation is deferred to `finalize`; the component can compute
deterministic output URLs and register requests synchronously. Development
images are handled by Vite middleware.

## Framework lifecycle

### Configuration and Vite setup

`siteViteConfig` should:

1. load and validate `nib.config.ts`;
2. resolve the base path;
3. create a frozen `NibVitePluginContext`;
4. invoke the app-owned `vite` factory, when configured;
5. await each configured package plugin's `vite` hook;
6. flatten valid Vite `PluginOption` values;
7. insert them before the generated project and island-entry adapters;
8. preserve app or plugin attribution if contribution creation fails.

The initial array order should be:

```text
Nib Markdown and data-page adapters
App Vite contribution (for example Tailwind)
Package plugin contributions
React
Nib generated-project adapter
Nib island-entry adapter
```

Vite still applies `enforce: "pre"` and `enforce: "post"` across that array.
The fixed default order gives plugins a predictable seam without allowing them
to replace the generated route or island entries.

The image metadata import plugin uses normal Vite `resolveId`, `load`,
`configureServer`, and `hotUpdate` hooks. It must not mutate Nib's
internal plugin array or import Nib internals.

### Server renderer setup

`createProjectRenderer` should:

1. validate islands and load collections as it does now;
2. create a frozen `NibRendererPluginContext`;
3. await each configured plugin's `renderer` hook once;
4. retain the resulting extensions in config order;
5. compose the page, layouts, and shell, then apply plugin wrappers before
   `renderReactPage`;
6. apply synchronous `transformPage` hooks to the static page fields while Nib
   retains the separately collected island metadata;
7. track every successfully rendered canonical path;
8. expose `finalize(context)` alongside `paths` and `render`.

Wrapping happens around the complete site shell so a provider can observe image
components in the page, layouts, or shell:

```text
Plugin 1 provider
└── Plugin 2 provider
    └── Shell
        └── Folder and named layouts
            └── Page
```

The wrapper cannot change Nib's document template or tags outside the React
shell. The first interface should not expose arbitrary template mutation.

### Production prerender

Replace immediate route writes with an explicit collect, finalize, write
sequence:

```ts
const rendered = server.paths.map((routePath) => ({
  routePath,
  page: server.render(routePath),
}))

const notFound = {
  routePath: '/404',
  page: server.render('/404'),
}

await server.finalize({
  clientDirectory,
})

await mapWithConcurrency(
  [...rendered, notFound],
  writeConcurrency,
  async ({ routePath, page }) => {
    const file = outputFile(clientDirectory, routePath)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, renderDocument(template, page))
  },
)
```

Holding rendered HTML in memory is acceptable for Nib's static-site scope and
ensures a failed image transformation does not leave HTML referring to missing
files. If very large sites later show memory pressure, store pending documents
in a temporary directory and atomically move them after finalization without
changing the plugin contract.

### Development

Development continues to render on each request. Renderer extensions are
active, but `finalize` is not called.

A plugin that needs generated assets must supply Vite development middleware.
For images:

1. the `?nib-image` load hook records an opaque source ID and absolute file path
   in the Vite plugin instance;
2. the generated metadata module carries the source ID, content fingerprint,
   dimensions, orientation, and format;
3. `Image` emits URLs under a reserved path such as
   `/@nib-images/<opaque-source-id>/<width>-<quality>.<format>`;
4. middleware validates the source ID and transformation request;
5. it serves a disk-cached transform and deduplicates concurrent
   requests for the same key;
6. Vite explicitly watches every imported source and HMR re-inspects only the
   changed file, retrying across editor overwrite windows;
7. changed bytes produce a new request key and ETag, while a timestamp-only or
   byte-identical rewrite retains the existing artifact and returns `304`.

Never encode an unrestricted absolute path in a browser URL. Reject unknown
source IDs, path traversal, unsupported formats, unconfigured qualities,
oversized dimensions, and files outside the allowed project roots.
Server-only file paths and source IDs are non-enumerable on metadata objects so
they cannot leak through unrelated object serialization.

## Image source imports

Use an explicit query so the plugin does not change Vite's normal image URL
imports:

```ts
import hero from './hero.jpg?nib-image'
```

The package supplies an ambient declaration:

```ts
declare module '*?nib-image' {
  const source: import('@briansunter/nib-images').ImageSource
  export default source
}
```

The Vite load hook calculates:

```ts
declare const imageSourceBrand: unique symbol

export interface ImageSource {
  readonly [imageSourceBrand]: true
  readonly width: number
  readonly height: number
  readonly format: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'svg'
  readonly hasAlpha: boolean
  readonly animated: boolean
  readonly fingerprint: string
}
```

The public value is opaque. Generated modules should create it through an
unexported or explicitly internal constructor that also retains a validated
filesystem path for build processing. Consumers should not be able to forge a
local `ImageSource` accidentally with a plain object. The unexported unique
symbol makes the public type nominal without exposing filesystem information.

Metadata dimensions must account for EXIF orientation. Width and height in the
rendered HTML describe the displayed orientation, not merely the encoded pixel
matrix.

The first release supports local JPEG, PNG, WebP, and AVIF imports. SVG and
animated GIF/WebP sources pass through unchanged unless a future explicit
rasterization or animation option is enabled.

## Type-safe `Image` component

The component should accept normal safe image attributes while reserving
attributes generated by the optimizer:

```ts
import type { ImgHTMLAttributes } from 'react'

export type ImageFormat = 'avif' | 'webp' | 'jpeg' | 'png'
type ImageEventProp = Extract<
  keyof ImgHTMLAttributes<HTMLImageElement>,
  `on${string}`
>

interface ImageCommonProps
  extends Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    | ImageEventProp
    | 'alt'
    | 'children'
    | 'dangerouslySetInnerHTML'
    | 'src'
    | 'srcSet'
    | 'width'
    | 'height'
    | 'sizes'
    | 'loading'
    | 'decoding'
  > {
  src: ImageSource
  alt: string
  formats?: readonly ImageFormat[]
  quality?: number | Partial<Record<'avif' | 'webp' | 'jpeg', number>>
  unoptimized?: boolean
}

interface AutomaticImageLayout {
  layout?: 'constrained'
  width?: number
  widths?: readonly number[]
  sizes?: string
  densities?: never
}

interface FixedImageLayout {
  layout: 'fixed'
  width: number
  densities?: readonly (1 | 1.5 | 2 | 3)[]
  widths?: never
  sizes?: never
}

interface FullWidthImageLayout {
  layout: 'full'
  widths?: readonly number[]
  sizes?: string
  width?: never
  densities?: never
}

type PriorityImage = {
  priority: true
  loading?: never
  fetchPriority?: never
}

type DeferredImage = {
  priority?: false
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'low' | 'auto'
}

export type ImageProps =
  & ImageCommonProps
  & (
    | AutomaticImageLayout
    | FixedImageLayout
    | FullWidthImageLayout
  )
  & (PriorityImage | DeferredImage)
```

Important type behavior:

- `alt` is required but may be `""` for a decorative image.
- Consumers cannot provide `srcSet`; the component owns it.
- `fixed` uses density descriptors and rejects `sizes`.
- `full` rejects a fixed display width.
- `constrained` defaults to the oriented source width when `width` is omitted.
- `priority` cannot be combined with manual loading or fetch-priority hints.
- `quality` values are validated at runtime even though TypeScript can only
  express `number`.
- `quality` applies to AVIF, WebP, and JPEG. PNG fallback output remains
  lossless with a fixed compression level.
- `unoptimized` emits the imported source with intrinsic dimensions and normal
  loading attributes. It registers a content-hashed pass-through copy, but no
  resized or converted variants.
- Event handlers, children, and `dangerouslySetInnerHTML` are rejected. The
  first image component is a static-rendering primitive, not an interactive
  island component.
- `className`, `style`, ARIA attributes, and safe ordinary `img` attributes
  pass through to the fallback `img`.

Using the component without a configured `images()` provider must throw:

```text
@briansunter/nib-images: <Image> requires images() in nib.config.ts
```

This is preferable to silently shipping the original source or rendering
broken URLs.

## Responsive candidate selection

No build tool can infer the final width of an image under arbitrary CSS. The
component should automate common layout contracts and make the remaining
information explicit through `sizes`.

Normalize the configured width ladder once:

1. reject non-integers and non-positive values;
2. sort ascending;
3. remove duplicates;
4. cap every candidate at the oriented source width;
5. always include the exact requested maximum width when it is not already in
   the ladder;
6. remove candidates so close together that they provide no meaningful byte or
   selection benefit;
7. never upscale unless a future explicit `allowUpscale` option is added.

Layout behavior:

| Layout | Candidate rule | Default `sizes` |
| --- | --- | --- |
| `fixed` | `width × densities`, capped at source | Density descriptors; no `sizes` |
| `constrained` | Width ladder through `min(source, width × 2)` | `(max-width: Wpx) 100vw, Wpx` |
| `full` | Width ladder through source width | `100vw` |

An explicit `widths` list replaces the configured ladder after validation.
An explicit `sizes` string replaces the generated value. Nib should document
that multi-column layouts need an accurate `sizes` expression for the browser
to select the best file.

## Output markup

For a transformable raster source, render:

```html
<picture>
  <source
    type="image/avif"
    srcset="/base/assets/nib/hero.KEY-480.avif 480w, ..."
    sizes="100vw"
  />
  <source
    type="image/webp"
    srcset="/base/assets/nib/hero.KEY-480.webp 480w, ..."
    sizes="100vw"
  />
  <img
    src="/base/assets/nib/hero.KEY-1280.jpg"
    srcset="/base/assets/nib/hero.KEY-480.jpg 480w, ..."
    sizes="100vw"
    width="2400"
    height="1600"
    loading="lazy"
    decoding="async"
    alt="A trail crossing a mountain ridge"
  />
</picture>
```

Defaults:

- `loading="lazy"` and `decoding="async"` for ordinary images;
- `loading="eager"` and `fetchpriority="high"` for `priority`;
- AVIF and WebP sources in configured order;
- JPEG fallback for opaque photographic sources;
- PNG fallback for alpha sources;
- the largest requested fallback candidate as `src`;
- oriented intrinsic `width` and `height` attributes;
- base-aware URLs generated with the same normalized base as `siteHref`.

The component should add only the layout styles needed to make its `sizes`
contract true:

- `full` uses `width: 100%; height: auto`;
- `constrained` uses `max-width: 100%; height: auto`;
- `fixed` adds no responsive width rule.

Merge user styles after the defaults so authors retain control, and document
that overriding width behavior also requires an accurate explicit `sizes`.

The current API does not expose a placeholder option. A future static
dominant-color placeholder must be measured against no placeholder before it is
added; a blur-up implementation requiring client JavaScript is out of scope.

## Request registry

The image renderer extension owns one build-scoped registry:

```ts
interface ImageTransformRequest {
  readonly key: string
  readonly source: ImageSource
  readonly width: number
  readonly format: ImageFormat
  readonly quality: number
}

interface ImageBuildRegistry {
  register(request: ImageTransformRequest): string
  requests(): readonly ImageTransformRequest[]
}
```

`register`:

1. normalizes every option;
2. validates it against plugin-level allowlists;
3. computes a stable request key;
4. stores the first equivalent request in a `Map`;
5. returns the final base-aware URL immediately.

The request key must include:

- source content fingerprint;
- oriented transformation dimensions;
- output format and encoder options;
- normalized quality;
- alpha/animation policy;
- image plugin cache schema version;
- processor name and version.

It must not include absolute paths, project root, route path, machine-specific
temporary directories, or file modification time. Identical source bytes and
options should reuse the same cache entry on different machines.

## Sharp processing and concurrency

The Sharp implementation should be isolated behind an internal processor
interface so it can be tested with a deterministic fake:

```ts
interface LocalImageProcessor {
  readonly name: string
  readonly version: string

  inspect(file: string): Promise<InspectedImage>

  transform(
    file: string,
    request: NormalizedImageTransform,
  ): Promise<Uint8Array>
}
```

Do not publish a provider-neutral image-service API until there is a second
real backend. The separation should exist internally, while the first public
release exposes only the proven Sharp service. A CDN-backed service can later
be added without changing `ImageProps`.

Processing strategy:

1. read cache entries and create output links with bounded I/O parallelism;
2. place every cache miss in one global transform queue;
3. create one auto-oriented Sharp pipeline snapshot per source fingerprint;
4. clone that snapshot for requested width/format combinations;
5. enforce `concurrency` across all active transforms, including many variants
   of one source;
6. let Sharp/libvips parallelize within each active image;
7. write each result and checksum metadata to temporary cache files;
8. atomically rename them to the cache key;
9. hard-link the cached artifact into `dist/client` when the filesystem allows
   it, otherwise copy it;
10. deduplicate concurrent promises for the same request key.

Default concurrency should use `os.availableParallelism()` and a conservative
memory estimate:

```text
active transforms =
  min(
    available parallelism,
    configured maximum,
    floor(memory budget / conservative bytes per active transform)
  )
```

Do not assume that more JavaScript promises mean more throughput. Sharp uses a
libuv thread pool, libvips uses threads within an image, and some AVIF encoders
create additional threads. Automatic concurrency is capped by available
parallelism and `UV_THREADPOOL_SIZE` (four when unset). `memoryLimitMb` applies a
conservative 192 MB-per-active-transform estimate and never prevents the one
transform required to make progress.

## Cache design

Default cache location:

```text
.nib/cache/images/
├── ab/
│   ├── REQUEST_KEY.avif
│   └── REQUEST_KEY.avif.json
└── cd/
    ├── REQUEST_KEY.webp
    └── REQUEST_KEY.webp.json
```

Requirements:

- `dist` deletion must not remove the cache.
- A source-content or normalized-option change must cause a miss.
- A plugin/processor cache-schema change must cause a miss.
- Corrupt, truncated, metadata-mismatched, or zero-byte entries are misses and
  are replaced atomically.
- A warm build must not decode or encode an unchanged cached transform.
- File modification time is not part of the key: touching or byte-identically
  rewriting a source must reuse its cached transforms.
- The cache may be deleted safely at any time.
- Cache pruning is initially manual; automatic LRU pruning can follow once real
  projects establish useful size and age defaults.
- The plugin reports cold transforms, cache hits, bytes written, and elapsed
  time in one concise build summary.

## Format and source policy

The first implementation should make conservative decisions:

- auto-orient raster sources before calculating output dimensions;
- preserve alpha by using alpha-capable output formats;
- strip unnecessary metadata by default;
- retain a correct color-space conversion rather than blindly discarding
  profiles;
- avoid upscaling;
- pass through SVG without rasterization;
- pass through animated images without dropping frames;
- support explicit `unoptimized` pass-through for tiny or already optimized
  sources;
- validate every decoded input against pixel and channel limits;
- fail with source-oriented errors for corrupt or unsupported inputs.

Generating multiple formats is a trade-off between build cost, storage, and
transfer size. Keep the default configurable and benchmark AVIF plus WebP
against WebP-only before choosing the package default. Do not call any one
format universally optimal.

## Base paths and filenames

Output paths should be deterministic and readable:

```text
dist/client/assets/nib/<safe-stem>.<short-key>-<width>.<format>
```

The request key, not the source filename, provides uniqueness. Sanitize the
stem and limit its length. All rendered URLs must use Nib's already resolved
base:

```text
/assets/nib/...             base "/"
/repository/assets/nib/...  base "/repository/"
```

Never derive a filesystem target by joining an unvalidated URL. The output
writer starts from the fixed client directory and a plugin-controlled relative
asset path.

## Markdown integration

Do not block the first release on automatic Markdown image rewriting. Current
Markdown compilation produces an HTML string and does not expose a plugin
transform context containing the source file and an image registry.

Add Markdown support in a follow-up after the component pipeline is proven:

1. give Markdown compilation a source-file context;
2. add a narrow typed Markdown AST extension seam rather than letting plugins
   replace the whole compiler;
3. resolve relative image URLs against the Markdown source;
4. turn eligible local images into the same registry requests and static
   `<picture>` markup;
5. retain ordinary Markdown `img` output for remote, animated, SVG, or opted-out
   sources;
6. test frontmatter layouts, base paths, and source-located errors.

This preserves the existing boundary between Markdown parsing and Vite code
generation.

## Implementation sequence

### Phase 1: Generic plugin types and validation

Add:

```text
src/framework/plugin.ts
src/plugin.ts
tests/plugin.test.ts
tests/plugin.typecheck.ts
```

Change:

- `NibConfig` to accept `plugins?: readonly NibPlugin[]`;
- `defineConfig` only as needed to retain its existing const-generic behavior;
- package exports and framework build entries for `@briansunter/nib/plugin`;
- configuration validation for names, duplicates, and hook types.

Use a small fake plugin in tests. Do not introduce Sharp in this phase.

### Phase 2: Vite and renderer lifecycle

Change:

```text
src/framework/site.ts
src/framework/project-renderer.ts
src/framework/project-vite-plugin.ts
src/runtime/server.ts
tests/project-vite-plugin.test.ts
tests/project-renderer.test.tsx
tests/site-build.test.ts
tests/site-dev.test.ts
```

Implement:

- typed Vite contribution resolution;
- renderer-extension creation;
- deterministic page wrapping and transformation;
- `ProjectRenderer.finalize`;
- server-entry `finalize` export;
- collect/finalize/write production sequencing;
- bounded parallel HTML writes;
- hook error attribution and lifecycle guards.

Prove that a no-plugin site produces byte-equivalent relevant output.

### Phase 3: Image package and metadata imports

Create the separate image package with:

```text
src/index.ts
src/plugin.ts
src/image-source.ts
src/image-component.tsx
src/image-context.ts
src/image-vite-plugin.ts
src/image-registry.ts
src/candidates.ts
src/cache.ts
src/sharp-processor.ts
```

Implement `?nib-image`, opaque metadata, local-source validation, orientation,
source fingerprinting, and type declarations. Add tiny committed fixtures for
opaque, alpha, oriented, animated, SVG, and corrupt cases.

### Phase 4: Static component and production processing

Implement:

- the discriminated `ImageProps` API;
- layout-to-candidate normalization;
- static `<picture>` output;
- lazy and priority behavior;
- build-scoped request registration;
- cache keys and atomic cache writes;
- bounded Sharp processing;
- asset linking/copying into `dist/client`;
- base-path-safe URLs;
- concise build statistics.

### Phase 5: Development and HMR

Implement:

- the reserved development URL;
- strict request parsing and source-ID lookup;
- in-flight request deduplication;
- checksum-validated disk cache lookup;
- correct content types and cache headers;
- explicit source watching, HMR re-inspection, and editor overwrite retries;
- changed-content ETags and byte-identical cache reuse;
- friendly overlay errors for failed transforms.

### Phase 6: Documentation and performance calibration

Add a documentation page covering installation, layouts, `sizes`, priority,
formats, cache behavior, SVG/animation limits, and deployment output. Update
the architecture document only after the feature exists.

Benchmark cold and warm builds before fixing defaults.

## Test plan

### Plugin contract

- `definePlugin` contextually types every hook.
- `defineConfig` preserves a readonly plugin tuple.
- invalid hook return types fail typechecking.
- duplicate or blank plugin names fail config validation.
- app and package Vite contributions appear in dev and both production builds
  with fresh instances per graph.
- config order and wrap order are deterministic.
- `transformPage` receives the correct route and base.
- `finalize` sees all successful routes including 404.
- `finalize` runs once and rendering afterward fails.
- hook errors identify plugin, hook, and route.
- sites without plugins preserve existing behavior.

### Image types

- imported `?nib-image` values satisfy `ImageSource`.
- ordinary Vite image imports remain strings.
- missing `alt` fails typechecking.
- `fixed` plus `sizes` fails typechecking.
- `full` plus `width` fails typechecking.
- `priority` plus `loading` fails typechecking.
- user-supplied `srcSet` fails typechecking.
- event handlers and children fail typechecking.
- normal class, style, ARIA, and safe image attributes remain accepted.

### Image output

- intrinsic dimensions respect EXIF orientation.
- fixed, constrained, full, explicit-width, and explicit-sizes cases produce
  the expected candidates.
- no candidate exceeds the source width.
- duplicate candidates are removed.
- AVIF, WebP, and fallback sources use correct MIME types and descriptors.
- opaque and alpha inputs choose valid fallbacks.
- lazy images use lazy loading and async decoding.
- priority images use eager loading and high fetch priority.
- output contains no island marker or image client script.
- root and repository base paths prefix every variant.

### Processing and cache

- identical requests across routes transform once.
- concurrent identical requests share one promise.
- a warm build performs no transforms.
- source bytes, width, quality, format, processor version, and cache schema
  changes each invalidate the right entry.
- corrupt cache entries are replaced.
- writes are atomic under simulated interruption.
- concurrency never exceeds the configured bound.
- failures do not leave final HTML referencing absent assets.
- cached artifacts are linked when possible and copied otherwise.

### Development and security

- development middleware serves each supported format with the correct content
  type.
- repeated requests hit cache.
- edits invalidate only affected source variants.
- unknown IDs, traversal attempts, unsupported formats, huge widths, and
  disallowed qualities are rejected.
- files outside allowed roots are rejected, including symlink escapes.
- malformed and oversized inputs fail without excessive memory allocation.

### End-to-end proof

Create a packed-package fixture site containing:

- a priority full-width hero;
- a constrained article image;
- a fixed avatar;
- the same source reused on two routes;
- an alpha image;
- a static route with no islands.

Run:

```bash
bun run typecheck
bun run test
bun run build
SITE_BASE_PATH=/nib/ bun run build
bun run check:version-policy
npm pack --dry-run --json
```

Then verify:

- all HTML references exist under `dist/client`;
- image dimensions and MIME types match the markup;
- no unintended source originals or absolute filesystem paths ship;
- no route gains the island client entry because it uses `Image`;
- preview serves the assets under both root and subpath bases;
- a real browser chooses a smaller candidate at a mobile viewport;
- the hero is discoverable early and lower images remain lazy;
- a second build reports cache hits and materially shorter image-processing
  time.

## Performance benchmark

Add a repeatable benchmark fixture rather than choosing concurrency and format
defaults by intuition:

- at least 20 photographic and alpha images;
- a mix of 1 MP, 4 MP, and 12 MP sources;
- repeated sources across routes;
- fixed, constrained, and full-width layouts;
- AVIF, WebP, and fallback output.

Record:

- cold build wall time;
- warm build wall time;
- transforms per second;
- peak resident memory;
- cache-hit ratio;
- total generated bytes by format;
- total bytes selected at representative mobile and desktop viewports.

Compare bounded global transform concurrency values and WebP-only versus AVIF
plus WebP.
Select defaults from throughput, memory, and transfer results together. The
fastest encoder setting is not automatically the best site output, and the
smallest output is not automatically worth a disproportionate build cost.

### Current calibration

On the 12-core Apple development machine used for the July 2026 audit, the
repeatable 1 MP/2 MP alpha/4 MP/12 MP stress set produced:

| Formats and concurrency | Cold | Warm | Transforms/s | Peak RSS | Output |
| --- | ---: | ---: | ---: | ---: | ---: |
| AVIF + WebP + fallback, 1 | 3676 ms | 21 ms | 12.24 | 389 MB | 21.11 MB |
| AVIF + WebP + fallback, 2 | 1827 ms | 23 ms | 24.63 | 485 MB | 21.11 MB |
| AVIF + WebP + fallback, 4 | 1100 ms | 23 ms | 40.91 | 575 MB | 21.11 MB |
| WebP + fallback, 4 | 710 ms | 17 ms | 42.25 | 346 MB | 18.94 MB |

Four active transforms matched the default libuv task capacity and was the
fastest tested setting. AVIF added build work and 2.28 MB of generated storage
but its variants totaled 2.28 MB versus 4.42 MB for WebP on the same inputs.
The processor therefore keeps AVIF plus WebP as the transfer-oriented default,
uses AVIF effort 2, progressive JPEG, WebP effort 4, and exposes WebP-only plus
lower concurrency for build-time or memory-constrained projects. Run
`bun run benchmark:images` on deployment hardware rather than treating these
machine-specific values as universal.

## External references

Use primary documentation while implementing and pin behavior to the versions
actually installed in the package:

- [Vite Plugin API](https://vite.dev/guide/api-plugin.html) for hook ordering,
  development middleware, HMR, and the limits of `transformIndexHtml` in
  framework-owned document pipelines.
- [Sharp performance](https://sharp.pixelplumbing.com/performance/) for libuv,
  libvips, and per-image concurrency behavior.
- [Sharp constructor and clone](https://sharp.pixelplumbing.com/api-constructor/)
  for sharing one input across output pipelines.
- [Sharp input metadata](https://sharp.pixelplumbing.com/api-input/) for
  header-level inspection and orientation caveats.
- [Next.js Image](https://nextjs.org/docs/app/api-reference/components/image)
  for the relationship between `sizes`, responsive `srcset`, loading, decoding,
  and priority hints.
- [Astro Image Service API](https://docs.astro.build/en/reference/image-service-reference/)
  for a proven separation between stable image authoring and replaceable
  transformation services.

## Acceptance criteria

The feature is complete only when:

- Nib has a documented, exported, type-safe generic plugin contract;
- plugin hooks work in dev, client build, server build, prerender, and preview;
- the image processor remains absent from Nib's dependency graph and client
  bundles;
- an imported local image needs no manually supplied intrinsic dimensions;
- common layouts generate responsive candidates without manual width lists;
- explicit `sizes` remains available for layouts Nib cannot infer;
- outputs are deduplicated, content-addressed, cached, and base-aware;
- production processing is bounded and demonstrably parallel;
- image-only pages ship no hydration runtime;
- packed consumer tests prove the published package boundaries;
- cold/warm performance and browser candidate selection are measured;
- documentation clearly distinguishes implemented behavior from later remote,
  Markdown, SVG-rasterization, and animated-image work.

## Rollout

Release the generic plugin contract from Nib first as a minor `0.x` release.
Build the image package against that published contract rather than an
unreleased internal import. Keep the first plugin API additive; do not rename
existing page, layout, island, or collection concepts.

The image package can then release independently. Nib's core documentation may
recommend it without making it a default install. This preserves the deletion
test: removing `@briansunter/nib-images` removes image-specific code,
dependencies, cache behavior, and configuration while leaving the Nib
framework intact.
