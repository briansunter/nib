import { Behavior } from '../src/framework/behaviors'
import { behavior } from '../src/runtime/behaviors'

;<Behavior name="valid" />
;<Behavior name="valid" props={{ label: 'Details', count: 2 }} />

// @ts-expect-error behavior props must be JSON-serializable
;<Behavior name="invalid" props={{ onClick: () => undefined }} />

behavior<{ label: string }>(({ root, props, signal }) => {
  root.dataset.label = props.label
  signal.throwIfAborted()
})
