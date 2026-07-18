import type { PageMeta } from '../framework/types'
import Counter from '../islands/counter'

export const meta: PageMeta = {
  title: 'Home',
  description: 'A small static-site starter for React, Markdown, and opt-in islands.'
}

export default function HomePage() {
  return (
    <section className="space-y-8">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-300">Nib</p>
      <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-7xl">Static-first React sites, one page at a time.</h1>
      <p className="max-w-2xl text-lg text-slate-300">Write TSX or Markdown, prerender every route, and hydrate only explicit React islands.</p>
      <Counter initialCount={0} hydrate="load" />
    </section>
  )
}
