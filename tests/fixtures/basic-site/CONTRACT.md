# Advanced site contract fixture

This fixture is the frozen cross-feature baseline for Nib framework changes.
It contains:

- a static Markdown route with a layout;
- a React-island route and a static route without the runtime;
- schema-validated data pages and collections;
- plugin-owned resources and a configured redirect;
- a base path, trailing-slash policy, custom shell, and custom 404;
- a single deployable global stylesheet.

Framework batches may extend the fixture, but must not weaken its output
assertions in `tests/integrations.test.ts`, `tests/site-dev.test.ts`, and
`tests/package-consumer.test.ts`.
