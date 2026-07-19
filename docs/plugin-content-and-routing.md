# Plugin content and routing

## Goal

Allow optional packages to add data formats and virtual static routes without
giving them ownership of Nib configuration, route normalization, rendering, or
output paths.

The target examples are:

- a TOML plugin contributing a typed `page.toml` source;
- a sitemap plugin inspecting project routes and returning `sitemap.xml`;
- an RSS plugin returning a typed XML resource route (supported through the
  generic API; there is not yet a built-in RSS helper);
- a plugin observing the final route manifest for validation or reporting.

Typed document/head mutation is outside this design.

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

This is the mechanism for RSS today: a plugin registers a resource route with
an XML body and `application/rss+xml` content type. Nib ships the separate
`@briansunter/nib/sitemap` helper, but deliberately does not prescribe an RSS
data model or feed helper yet.

Redirect routes provide a destination and one of `301`, `302`, `307`, or `308`.
Development sends the status and `Location` header. Static output uses safe
HTML containing a canonical link and immediate meta refresh because a static
file cannot select its HTTP status.

## Path policy

Route identity ignores a trailing slash, so `/about` and `/about/` cannot be
registered separately. The configured trailing-slash policy controls the
public path exposed to pages and plugins:

- `ignore` and `never` expose `/about`;
- `always` exposes `/about/`;
- `/` is always `/`;
- resource paths ending in a filename extension are never given a trailing
  slash.

Development redirects a successfully matched route to its canonical spelling
for `always` and `never`. Static output remains directory-style, and deployment
hosts remain responsible for enforcing request URL policy.

## Ownership and errors

Every contributed page source and route retains its plugin owner for errors.
Nib validates hook shapes, returned contribution shapes, MIME types, redirect
destinations, status codes, and duplicate routes before rendering.

Resolved-route inspectors receive no React implementation, page data, route
handler, or mutable internal object. They can build indexes and diagnostics
without gaining authority over rendering.
