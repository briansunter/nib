import { RecipeControlsBehavior } from '../client-behaviors'

export default function RecipeControls({ defaultUnit }: { defaultUnit: 'metric' | 'imperial' }) {
  return (
    <RecipeControlsBehavior props={{}} hydrate="load">
      <div className="flex items-center gap-3 font-sans">
        <span id="scale-label" className="text-sm text-ink-muted">Scale</span>
        <div className="segmented-control" role="group" aria-labelledby="scale-label">
          {[
            [0.5, '½ ×', 'Half scale'],
            [1, '1 ×', 'Normal scale'],
            [2, '2 ×', 'Double scale'],
            [3, '3 ×', 'Triple scale'],
          ].map(([value, label, aria]) => (
            <button
              type="button"
              className="scale-btn segmented-button"
              data-scale={value}
              data-active={value === 1 ? '' : undefined}
              aria-label={String(aria)}
              aria-pressed={value === 1}
              key={String(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="number"
          id="custom-scale"
          className="w-12 rounded-lg border border-border bg-transparent px-2 py-1.5 text-center text-sm font-medium text-ink transition-colors hover:border-ink-muted focus:border-ink-muted focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          min="0.5"
          max="10"
          step="0.5"
          defaultValue="1"
          aria-label="Custom scale"
        />
      </div>
      <span className="hidden text-border sm:block">·</span>
      <div className="flex items-center gap-3 font-sans">
        <span id="unit-label" className="text-sm text-ink-muted">Units</span>
        <div className="segmented-control" role="group" aria-labelledby="unit-label">
          {(['metric', 'imperial'] as const).map((value) => (
            <button
              type="button"
              className="unit-btn segmented-button"
              data-unit={value}
              data-active={defaultUnit === value ? '' : undefined}
              aria-label={`Use ${value} units`}
              aria-pressed={defaultUnit === value}
              key={value}
            >
              {value === 'metric' ? 'Metric' : 'Imperial'}
            </button>
          ))}
        </div>
        <input
          type="checkbox"
          id="unit-toggle"
          className="hidden"
          defaultChecked={defaultUnit === 'metric'}
        />
      </div>
    </RecipeControlsBehavior>
  )
}
