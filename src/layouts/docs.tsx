import type { ReactNode } from 'react'
import { siteHref } from '../framework/urls'

const documentation = [
  { label: 'Overview', href: '/docs/' },
  { label: 'Getting started', href: '/docs/getting-started/' },
  { label: 'Pages and routes', href: '/docs/pages-and-routes/' },
  { label: 'Markdown and layouts', href: '/docs/markdown-and-layouts/' },
  { label: 'GitHub Pages', href: '/docs/github-pages/' },
  { label: 'Releases', href: '/docs/releases/' },
]

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <a className="text-sm font-medium uppercase tracking-[0.25em] text-sky-300" href={siteHref('/docs/')}>
          Documentation
        </a>
        <nav aria-label="Documentation" className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-300">
          {documentation.map((item) => (
            <a className="transition hover:text-white" href={siteHref(item.href)} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      {children}
    </div>
  )
}
