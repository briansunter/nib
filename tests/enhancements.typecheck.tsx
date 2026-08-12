import {
  enhance,
  type ClientEnhancement,
  type ClientInitializer,
} from '../src/index'

;<div {...enhance('valid')} />
;<div {...enhance('deferred', { when: 'visible' })} />

// @ts-expect-error enhancements only accept visible timing; omission means load
;<div {...enhance('invalid', { when: 'load' })} />

const positional = ((root, signal) => {
  root.dataset.mounted = 'true'
  signal.addEventListener('abort', () => delete root.dataset.mounted, { once: true })
}) satisfies ClientEnhancement

const client = ((signal) => {
  window.addEventListener('online', () => undefined, { signal })
}) satisfies ClientInitializer

// @ts-expect-error enhancement functions receive root and signal as positional arguments
const legacyContext: ClientEnhancement = ({ root, signal }) => {
  root.dataset.mounted = String(signal.aborted)
}

void positional
void client
void legacyContext
