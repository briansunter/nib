# Nib domain context

Nib is a static-by-default React site framework. File pages, Markdown pages,
and typed data pages become page routes. Only explicit islands ship browser
React.

## Routing terms

- **Page route** — a route rendered through React, layouts, the site shell, and
  the island collector.
- **Resource route** — a virtual static route whose adapter supplies a body and
  content type, such as `rss.xml` or `sitemap.xml`.
- **Redirect route** — a route that points to an internal path or an absolute
  HTTP(S) URL. Static builds emit redirect HTML; development responds with an
  HTTP redirect.
- **Resolved route** — the immutable public description of a page, resource, or
  redirect route after file routes, configured redirects, and plugin
  registrations have been merged and checked for collisions.
- **Route provider** — a plugin adapter that inspects the initial project routes
  and contributes page, resource, or redirect routes before the resolved-route
  inspection phase.
- **Trailing-slash policy** — `ignore`, `always`, or `never`; it controls
  canonical public paths and development redirects without changing Nib's
  directory-style static output.

## Extension rules

- App configuration owns project-specific Vite adapters.
- Plugins may contribute page-source adapters and route providers before route
  resolution.
- Plugins may inspect resolved routes but cannot mutate them.
- Renderer plugins may alter ordinary static page output but cannot alter island
  markup or hydration metadata.
- Typed document/head mutation is not an extension seam.
- Nib owns route collisions, path normalization, output filenames, base paths,
  and redirect safety.
