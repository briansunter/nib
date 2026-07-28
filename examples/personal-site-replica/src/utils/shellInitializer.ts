import { initSiteAnalytics } from '../lib/analytics'
import { initNewsletterForms } from './newsletterInitializer'

let cleanupHeaderNavigation: (() => void) | undefined
let backToTopController: AbortController | null = null
let socialProfilesController: AbortController | null = null

function initHeaderNavigation() {
  cleanupHeaderNavigation?.()

  const header = document.querySelector<HTMLElement>('[data-site-header]')
  if (!header) return

  const controller = new AbortController()
  const { signal } = controller
  cleanupHeaderNavigation = () => controller.abort()

  const menuToggle = header.querySelector<HTMLButtonElement>(
    '[data-mobile-menu-toggle]',
  )
  const mobileMenu = header.querySelector<HTMLElement>('[data-mobile-menu]')
  const openIcon = header.querySelector<HTMLElement>(
    '[data-mobile-menu-open-icon]',
  )
  const closeIcon = header.querySelector<HTMLElement>(
    '[data-mobile-menu-close-icon]',
  )

  const setMenuOpen = (isOpen: boolean, restoreFocus = false) => {
    if (!menuToggle || !mobileMenu) return

    menuToggle.setAttribute('aria-expanded', String(isOpen))
    mobileMenu.setAttribute('aria-hidden', String(!isOpen))
    mobileMenu.classList.toggle('hidden', !isOpen)
    openIcon?.classList.toggle('hidden', isOpen)
    closeIcon?.classList.toggle('hidden', !isOpen)
    menuToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu')
    if (!isOpen && restoreFocus) menuToggle.focus()
  }

  menuToggle?.addEventListener(
    'click',
    () => {
      setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true')
    },
    { signal },
  )

  mobileMenu?.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('a')) {
        setMenuOpen(false)
      }
    },
    { signal },
  )

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === 'Escape'
        && menuToggle?.getAttribute('aria-expanded') === 'true'
      ) {
        setMenuOpen(false, true)
      }
    },
    { signal },
  )

  window.addEventListener(
    'resize',
    () => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setMenuOpen(false)
      }
    },
    { signal },
  )

  const scrollY = Number(header.dataset.scrollY ?? 50)
  const addScrollY = Math.max(scrollY, 50)
  const removeScrollY = Math.max(scrollY - 50, 10)

  const setHeaderActive = (isActive: boolean) => {
    header.classList.toggle('is-active', isActive)
    header.classList.toggle('py-3', isActive)
    header.classList.toggle('py-4', !isActive)

    if (isActive) header.setAttribute('active', '')
    else header.removeAttribute('active')
  }

  const syncHeaderState = () => {
    if (window.scrollY > addScrollY) setHeaderActive(true)
    else if (window.scrollY < removeScrollY) setHeaderActive(false)
  }

  let ticking = false
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return

      ticking = true
      window.requestAnimationFrame(() => {
        syncHeaderState()
        ticking = false
      })
    },
    { passive: true, signal },
  )

  syncHeaderState()
}

function initSocialProfiles() {
  socialProfilesController?.abort()
  socialProfilesController = new AbortController()
  const { signal } = socialProfilesController

  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return

      const button = event.target.closest('[data-social-more]')
      if (!(button instanceof HTMLButtonElement)) return

      const hiddenGroupId = button.getAttribute('aria-controls')
      if (!hiddenGroupId) return

      const hiddenGroup = document.getElementById(hiddenGroupId)
      if (!hiddenGroup) return

      const nextExpanded = button.getAttribute('aria-expanded') !== 'true'
      hiddenGroup.hidden = !nextExpanded
      button.setAttribute('aria-expanded', String(nextExpanded))
      button.textContent = nextExpanded
        ? button.dataset.lessLabel || 'Less'
        : button.dataset.moreLabel || 'More'
    },
    { signal },
  )
}

function initBackToTop() {
  backToTopController?.abort()
  backToTopController = new AbortController()

  const button = document.getElementById('back-to-top')
  if (!button) return
  const backToTopButton = button
  const { signal } = backToTopController

  function updateVisibility() {
    if (window.scrollY > window.innerHeight) {
      backToTopButton.classList.remove('hidden')
      backToTopButton.classList.add('flex')
    } else {
      backToTopButton.classList.add('hidden')
      backToTopButton.classList.remove('flex')
    }
  }

  function scrollToTop() {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'instant' : 'smooth',
    })
  }

  updateVisibility()

  let ticking = false
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        updateVisibility()
        ticking = false
      })
    },
    { passive: true, signal },
  )
  window.addEventListener('resize', updateVisibility, { signal })
  backToTopButton.addEventListener('click', scrollToTop, { signal })
}

export function initSiteShell(): () => void {
  initSiteAnalytics()
  initHeaderNavigation()
  initSocialProfiles()
  initNewsletterForms()
  initBackToTop()

  return () => {
    cleanupHeaderNavigation?.()
    socialProfilesController?.abort()
    backToTopController?.abort()
  }
}
