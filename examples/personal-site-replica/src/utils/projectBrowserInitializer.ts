let projectBrowserController: AbortController | undefined

export function destroyProjectBrowser(): void {
  projectBrowserController?.abort()
  projectBrowserController = undefined
}

export function initProjectBrowser(): void {
  destroyProjectBrowser()

  const root = document.querySelector<HTMLElement>('[data-project-browser]')
  const form = root?.querySelector<HTMLFormElement>('[data-project-filters]')
  const status = root?.querySelector<HTMLElement>('[data-project-status]')
  if (!root || !form || !status) return

  const controller = new AbortController()
  projectBrowserController = controller
  const { signal } = controller
  const cards = [...root.querySelectorAll<HTMLElement>('[data-project-card]')]
  const tagButtons = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-project-tag]'),
  ]
  if (tagButtons.length === 0) return
  const sections = [
    ...root.querySelectorAll<HTMLElement>('[data-project-section]'),
  ]
  const currentUrl = new URL(window.location.href)
  const requestedTag = currentUrl.searchParams.get('tag')?.toLocaleLowerCase()
  let selectedTag = tagButtons.some(
    (button) => button.value.toLocaleLowerCase() === requestedTag,
  )
    ? (requestedTag ?? '')
    : ''

  const update = () => {
    let visible = 0

    for (const card of cards) {
      const tags = (card.dataset.projectTags ?? '').split('|')
      const matchesTag = !selectedTag || tags.includes(selectedTag)
      card.hidden = !matchesTag
      if (!card.hidden) visible += 1
    }

    for (const section of sections) {
      const sectionVisible = section.querySelectorAll(
        '[data-project-card]:not([hidden])',
      ).length
      section.hidden = sectionVisible === 0
      const count = section.querySelector<HTMLElement>(
        '[data-project-section-count]',
      )
      if (count) {
        count.textContent = `${sectionVisible} ${sectionVisible === 1 ? 'project' : 'projects'}`
      }
    }

    for (const button of tagButtons) {
      const pressed = button.value.toLocaleLowerCase() === selectedTag
      button.setAttribute('aria-pressed', String(pressed))
      button.classList.toggle('is-selected', pressed)
    }

    const selectedButton = tagButtons.find(
      (button) => button.value.toLocaleLowerCase() === selectedTag,
    )
    const countText =
      visible === 1 ? 'Showing 1 project' : `Showing ${visible} projects`
    status.textContent = selectedTag
      ? `${countText} for ${selectedButton?.dataset.projectTagLabel ?? selectedTag}.`
      : `${countText}.`

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete('tag')
    if (selectedTag) nextUrl.searchParams.set('tag', selectedTag)
    window.history.replaceState(
      {},
      '',
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
    )
  }

  for (const button of tagButtons) {
    button.addEventListener(
      'click',
      () => {
        const nextTag = button.value.toLocaleLowerCase()
        selectedTag = selectedTag === nextTag && nextTag ? '' : nextTag
        update()
      },
      { signal },
    )
  }
  update()
}
