# Plugin content and routing

## Goal

Allow optional packages to add data formats and virtual static routes without
giving them ownership of Nib configuration, route normalization, rendering, or
output paths.

The target examples are:

- a TOML plugin contributing a typed `page.toml` source;
- a sitemap plugin inspecting project routes and returning `sitemap.xml`;
- the first-party RSS plugin returning a typed `rss.xml` resource route;
- a plugin observing the final route manifest for validation or reporting.
- a renderer plugin contributing typed document-head elements.

## Resolution order

For each Vite graph, Nib loads and validates the app configuration, asks plugins
for page-source contributions, merges those contributions with app page
sources, validates extension conflicts, and then constructs its Vite adapters.
Contributions must be deterministic because client, server, and development
graphs receive fresh plugin state.

Inside the server renderer, Nib:

1. creates file and data-page routes;
2. adds configured redirects;
3. invokes route providers against the same immutable initial-route snapshot;
4. merges provider results in plugin order and rejects duplicate paths;
5. freezes public resolved-route snapshots;
6. invokes resolved-route inspectors in plugin order;
7. constructs renderer extensions.

Route providers do not observe routes returned by other providers. This avoids
order-dependent route generation. A sitemap therefore describes project page
routes, not other generated resources.

## Route kinds

Page routes participate in React rendering, layouts, the shell, metadata, and
island collection.

Resource routes provide a static body and MIME content type. A dotted route such
as `/rss.xml` is emitted as that exact file rather than
`/rss.xml/index.html`.

`@briansunter/nib/rss` is a first-party RSS 2.0 helper built on this mechanism.
It accepts typed channel fields and items; internal item paths are resolved with
Nib's `base`, while absolute HTTP(S) links remain unchanged. Its item provider
can asynchronously read the immutable initial route manifest, but applications
keep ownership of their content data model. The generic resource route remains
the extension point for Atom, JSON Feed, or a custom XML/JSON output.

Redirect routes provide a destination and one of `301`, `302`, `307`, or `308`.
Development sends the status and `Location` header. Static output uses safe
HTML containing a canonical link and immediate meta refresh because a static
file cannot select its HTTP status.

## Document head

Site configuration and page metadata accept a structured `HeadContribution` with
`meta`, `link`, `script`, and `style` elements. Renderer plugins can return the
same shape from `renderer().head(context)`. Nib emits site elements, page
elements, and plugin elements in that order, then keeps the document template
and island markers under framework ownership.

Attributes are escaped, event-handler names are rejected, and script/style raw
text is guarded against prematurely closing its element. The hook is synchronous
because the renderer's page and transform pipeline is synchronous; asynchronous
work belongs in plugin setup or finalization.

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

Every contributed page source and route retains its plugin owner for errors.
Nib validates hook shapes, returned contribution shapes, MIME types, redirect
destinations, status codes, and duplicate routes before rendering.

Resolved-route inspectors receive no React implementation, page data, route
handler, or mutable internal object. They can build indexes and diagnostics
without gaining authority over rendering.
