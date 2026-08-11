import { Behavior, type ClientBehavior } from '../src/index'

;<Behavior name="valid"><div /></Behavior>
;<Behavior name="deferred" defer="visible"><div /></Behavior>

// @ts-expect-error behaviors only accept idle or visible deferral
;<Behavior name="invalid" defer="load"><div /></Behavior>

const positional = ((root, signal) => {
  root.dataset.mounted = 'true'
  signal.addEventListener('abort', () => delete root.dataset.mounted, { once: true })
}) satisfies ClientBehavior

// @ts-expect-error behavior functions receive root and signal as positional arguments
const legacyContext: ClientBehavior = ({ root, signal }) => {
  root.dataset.mounted = String(signal.aborted)
}

void positional
void legacyContext
