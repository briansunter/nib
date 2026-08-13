export {
  compareSemanticHtml,
  normalizeSemanticText,
  semanticAttribute,
  semanticDirectChildTags,
  semanticDocument,
  semanticElements,
  semanticHasClass,
  semanticHtmlSnapshot,
  semanticRoots,
  semanticSnapshot,
  semanticTextContent,
} from './framework/testing'
export type {
  SemanticDate,
  SemanticDifference,
  SemanticHeading,
  SemanticHtmlComparison,
  SemanticHtmlSnapshot,
  SemanticLink,
  SemanticRoot,
  SemanticRootSelector,
  SemanticSnapshotOptions,
  SemanticSnapshotRootOptions,
  SemanticTextNormalizer,
  SemanticTraversalOptions,
} from './framework/testing'
export { renderReactPage } from './framework/render-page'
export type { RenderedReactPage } from './framework/render-page'
export { createBuildOutput } from './framework/build-output'
