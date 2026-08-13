# Static-first browser architecture redesign

Status: implemented on `master` in Nib 0.20.0

## Contract

- Native browser navigation owns document transitions and history.
- `enhance(name, { when?: 'visible' })` returns attributes spread onto an
  existing HTML element.
- Names map to `src/enhancements/<name>/index.client.ts` or `.js` modules.
- Enhancement modules default-export
  `(root: HTMLElement, signal: AbortSignal) => void | Promise<void>`.
- Final parsed HTML is the enhancement source of truth. Nib validates HTML
  namespace, IDs, timing metadata, and matching client modules.
- Enhancement JavaScript and CSS are linked only from routes that use them.
- `island(Component, { when?: 'load' | 'visible' })` is exported from
  `@briansunter/nib/react`; its fixed strategy and ID come from the definition
  and `src/islands` module path.
- Island props cross the static boundary as strict JSON. Each instance is an
  independent SSR/hydration root with its own `useId` prefix.
- Island JavaScript, React, and island-owned CSS are absent from island-free
  routes.
- Optional application-wide browser setup is auto-discovered at `src/client.ts`
  as a default `ClientInitializer` export.
- A project with no styles, initializer, enhancements, or islands retains a
  static-only build while client-target Vite hooks still run through a private
  inert entry.

## Removed surfaces

- first-party client navigation and navigation-history mutation;
- plugin-contributed `clientEntries`;
- `<Behavior>`, cloning contexts, manual marker ownership checks, and idle
  scheduling;
- navigation runtime coordination and route remount lifecycle;
- the prior broad React-island lifecycle and navigation coupling.

## Acceptance evidence

The 0.20.0 release passed type checking, unused-code checks, focused runtime
tests, fixture builds, scaffold and packed-package consumption, docs and example
builds, and production-output checks for route-scoped enhancement/island assets,
independent island SSR roots, the optional app initializer, and zero client
JavaScript for a static-only site.
