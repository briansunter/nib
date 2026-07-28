# Commonplace blog example

Commonplace is a deliberately small, fictional publication. It demonstrates
Nib's main composition model without copying a real personal site:

- TSX pages and Markdown posts with a shared typed layout
- a collection derived from Markdown routes
- JSON-backed typed data pages reused as a collection
- static responsive component and Markdown images
- one React island and one progressive client behavior
- optional client navigation with explicit prefetch hints
- canonical metadata, RSS, sitemap, and static search data
- redirects plus Netlify and S3 hosting companions

The content and identity are samples. Replace them with your own title, routes,
frontmatter, and styles.

## Run it

From the Nib repository:

```bash
bun install
bun run dev:blog
```

To verify the production output:

```bash
bun run verify:blog
```

The build writes the deployable site to `dist/client`. Pages work as ordinary
HTML without JavaScript; Nib ships browser code only for the theme behavior,
reading-goal island, and explicitly configured client navigation.
