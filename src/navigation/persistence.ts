export const PERSIST_ATTRIBUTE = 'data-nib-navigation-persist'

export function persistenceIndex(
  root: ParentNode,
  owner: string,
): Map<string, HTMLElement> {
  const result = new Map<string, HTMLElement>()
  for (const element of root.querySelectorAll<HTMLElement>(`[${PERSIST_ATTRIBUTE}]`)) {
    const key = element.getAttribute(PERSIST_ATTRIBUTE)?.trim()
    if (!key) throw new Error(`${owner} persistence keys must be non-empty`)
    if (result.has(key)) {
      throw new Error(`${owner} contains duplicate persistence key "${key}"`)
    }
    result.set(key, element)
  }
  return result
}

export function restorePersistedElements(
  currentRoot: HTMLElement,
  nextRoot: HTMLElement,
): (() => void) | undefined {
  const active = document.activeElement
  let restoreFocus: (() => void) | undefined
  const currentElements = [...currentRoot.querySelectorAll<HTMLElement>(
    `[${PERSIST_ATTRIBUTE}]`,
  )]
  persistenceIndex(currentRoot, 'Current root')
  const nextPersisted = persistenceIndex(nextRoot, 'Next root')
  const persisted = currentElements.filter((element) => !element.parentElement?.closest(
    `[${PERSIST_ATTRIBUTE}]`,
  ))

  for (const element of persisted) {
    const key = element.getAttribute(PERSIST_ATTRIBUTE)!.trim()
    const target = nextPersisted.get(key)
    if (!target || target.localName !== element.localName) continue

    if (active instanceof HTMLElement && element.contains(active)) {
      const selection = (
        active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
      )
        ? { start: active.selectionStart, end: active.selectionEnd }
        : undefined
      restoreFocus = () => {
        active.focus()
        if (
          selection
          && (active instanceof HTMLInputElement
            || active instanceof HTMLTextAreaElement)
        ) {
          active.selectionStart = selection.start
          active.selectionEnd = selection.end
        }
      }
    }
    target.replaceWith(element)
  }

  return restoreFocus
}
