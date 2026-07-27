import { useEffect } from 'react'
import { defineIsland } from '@briansunter/nib'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import 'photoswipe/dist/photoswipe.css'

function textFrom(element: Element): string {
  return element.textContent?.trim() ?? ''
}

function ContentEnhancements() {
  useEffect(() => {
    const article = document.querySelector<HTMLElement>('.prose-editorial')
    const imageAnchors: HTMLAnchorElement[] = []
    let lightbox: PhotoSwipeLightbox | undefined
    let cancelled = false

    if (article) {
      for (const image of article.querySelectorAll<HTMLImageElement>('img')) {
        const existing = image.closest<HTMLAnchorElement>('a')
        const anchor = existing ?? document.createElement('a')
        if (!existing) {
          image.parentElement?.insertBefore(anchor, image)
          anchor.appendChild(image)
        }
        anchor.classList.add('pswp-zoomable')
        anchor.href = image.currentSrc || image.getAttribute('src') || '#'
        anchor.dataset.pswpWidth = String(image.naturalWidth || Number(image.getAttribute('width')) || 1200)
        anchor.dataset.pswpHeight = String(image.naturalHeight || Number(image.getAttribute('height')) || 900)
        anchor.dataset.caption = image.alt || ''
        imageAnchors.push(anchor)
      }
    }

    const copyButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-copy-button]')]
    const copyHandlers = copyButtons.map((button) => {
      const handler = () => {
        const value = button.dataset.code ?? ''
        void navigator.clipboard?.writeText(value).then(() => {
          const prior = button.textContent
          button.textContent = 'Copied'
          window.setTimeout(() => { button.textContent = prior }, 1200)
        })
      }
      button.addEventListener('click', handler)
      return { button, handler }
    })

    const renderMermaid = async () => {
      const diagrams = [...document.querySelectorAll<HTMLElement>('.mermaid:not([data-mermaid-ready])')]
      if (diagrams.length === 0) return
      try {
        const module = await import('mermaid')
        const mermaid = module.default
        mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default' })
        for (const diagram of diagrams) {
          diagram.dataset.mermaidReady = 'true'
          diagram.textContent = diagram.dataset.mermaidSource ?? textFrom(diagram)
        }
        await mermaid.run({ nodes: diagrams })
      } catch {
        // Keep the source visible when a diagram is unsupported or malformed.
      }
    }

    const setupLightbox = async () => {
      if (!article || imageAnchors.length === 0) return
      const instance = new PhotoSwipeLightbox({
        gallery: article,
        children: 'a.pswp-zoomable',
        pswpModule: () => import('photoswipe'),
        bgOpacity: 0.94,
      })
      instance.on('uiRegister', function (this: any) {
        this.ui.registerElement({
          name: 'caption',
          order: 9,
          isButton: false,
          appendTo: 'root',
          className: 'pswp__custom-caption',
          onInit: (element: HTMLElement, pswp: any) => {
            const update = () => {
              const anchor = pswp.currSlide?.data?.element as HTMLElement | undefined
              element.innerHTML = anchor?.getAttribute('data-caption') ?? ''
            }
            pswp.on('change', update)
            update()
          },
        })
      })
      instance.init()
      if (cancelled) instance.destroy()
      else lightbox = instance
    }

    void renderMermaid()
    void setupLightbox()
    return () => {
      cancelled = true
      lightbox?.destroy()
      for (const { button, handler } of copyHandlers) button.removeEventListener('click', handler)
      for (const anchor of imageAnchors) anchor.classList.remove('pswp-zoomable')
    }
  }, [])

  return <span className="content-enhancements" hidden aria-hidden="true" />
}

export default defineIsland('content-enhancements', ContentEnhancements)
