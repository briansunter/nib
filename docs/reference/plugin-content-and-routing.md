# Plugin content and routing

Status: current

Last reviewed: 2026-07-28

## Goal

Allow optional packages to add data formats and virtual static routes without
giving them ownership of Nib configuration, route normalization, rendering, or
output paths.

The target examples are:

- a TOML plugin contributing a typed `page.toml` source;
- a sitemap plugin inspecting project routes and returning `sitemap.xml`;
- the first-party RSS plugin returning a typed `rss.xml` resource route;
- a renderer plugin contributing typed document-head elements.

## Resolution order

For each Vite graph, Nib loads and validates the app configuration, combines
app `pageSources`, declarative plugin `pageSources`, and source definitions
referenced by `fromPageSource()` collections, deduplicates them by identity,
and then constructs its Vite adapters. Plugins do not register application
browser entries; a site-wide initializer belongs in the auto-discovered
`src/client.ts` application seam.

Inside the server renderer, Nib:

1. creates file and data-page routes;
2. adds configured redirects;
3. resolves explicitly granted collection capabilities;
4. invokes route providers in plugin order, with each provider receiving the
   latest immutable route snapshot;
5. merges each result immediately and rejects duplicate paths;
6. constructs renderer extensions.

Route ordering is explicit: a later sitemap or feed can include routes
contributed by earlier plugins, while an earlier provider cannot depend on a
later one.

## Route kinds

Page routes participate in React rendering, layouts, the shell, metadata, and
enhancement and island collection.

Resource routes provide a static body and MIME content type. A dotted route such
as `/rss.xml` is emitted as that exact file rather than
`/rss.xml/index.html`.

`@briansunter/nib/rss` is a first-party RSS 2.0 helper built on this mechanism.
It accepts typed channel fields and items; internal item paths are resolved with
Nib's `base`, while absolute HTTP(S) links remain unchanged. Its item provider
can asynchronously read the current immutable route manifest, but applications
keep ownership of their content data model. It can alternatively accept
`fromCollection(collection, mapper)`. That capability resolves only when the
exact collection is registered by the site; the mapper receives deeply frozen
entries and its result is frozen before the resource provider sees it. Search
resources support the same capability. The generic resource route remains the
extension point for Atom, JSON Feed, or a custom XML/JSON output.

Redirect routes provide a destination and one of `301`, `302`, `307`, or `308`.
Development sends the status and `Location` header. Static output uses safe
HTML containing a canonical link and immediate meta refresh because a static
file cannot select its HTTP status.

## Document head

Page metadata accepts a structured `HeadContribution` with optional `title` and
`description` overrides plus `meta`, `link`, `script`, and `style` elements.
Shared site policy is an ordinary ordered `siteMetadata()` renderer plugin, and
other renderer plugins can return the same shape from
`renderer().head(context)`. Nib emits page elements followed by plugin elements
in configuration order. Later non-empty title and description overrides win.

Attributes are escaped, event-handler names are rejected, and script/style raw
text is guarded against prematurely closing its element. The hook is
synchronous because page rendering is synchronous; asynchronous work belongs
in route creation, renderer creation, or finalization.

## Path policy

Route identity ignores a trailing slash, so `/about` and `/about/` cannot be
registered separately. The configured trailing-slash policy controls the
public path exposed to pages and plugins:

- `ignore` and `never` expose `/about`;
- `always` exposes `/about/`;
- `/` is always `/`;
- resource paths ending in a filename extension are never given a trailing
  slash.

Development and preview redirect a successfully matched route to its canonical
spelling for `always` and `never`. Static output uses the same policy when it
chooses directory indexes or extensionless leaf artifacts. The generated
`dist/client/.nib/publication.json` records that route-to-artifact mapping for
deployment hosts, which remain responsible for enforcing request URL policy.

## Ownership and errors

Every contributed route retains its plugin owner for errors. Nib validates
declarative page sources, hook shapes, returned route shapes, MIME types,
redirect destinations, status codes, and duplicate routes before rendering.

Route providers likewise do not receive a general collection registry. An
application must hand a provider a `fromCollection()` capability explicitly,
which prevents unrelated plugins from enumerating page-backed content.
