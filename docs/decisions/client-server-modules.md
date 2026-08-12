# ADR: explicit client and server modules

Status: accepted

Last reviewed: 2026-08-11

Nib applications may suffix JavaScript or TypeScript modules with `.client` or
`.server` before the file extension to state which build graph owns them (for
example, `.client.js` or `.server.tsx`). Production client builds reject server
modules and production server builds reject client modules. Diagnostics include
the import chain that crossed the boundary.

Public package imports follow the same rule:

- `@briansunter/nib` contains universal authoring definitions and types;
- `@briansunter/nib` contains the universal `ClientEnhancement` and
  `ClientInitializer` types;
- `@briansunter/nib/react` contains the browser-safe React island authoring API;
- `@briansunter/nib/internal/enhancements` and
  `@briansunter/nib/internal/islands` are reserved for generated framework
  entries;
- `@briansunter/nib/server` contains filesystem-backed loaders.

The historical `file` and `glob` root exports remain as lazy compatibility
wrappers until a separately approved major release. New code should import
them from `/server`, whose implementation uses ordinary static Node imports.

Development uses Vite's combined environment and does not reject either suffix
at configuration time. Each production graph is authoritative, and tests cover
both targets.
