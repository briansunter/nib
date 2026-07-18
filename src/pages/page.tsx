import type { PageMeta } from '../framework/types'
import Counter from '../islands/counter'

export const meta: PageMeta = {
  title: 'Home',
  description: 'A tiny file-routed static-site generator.'
}

export default function HomePage() {
  return (
    <section className="space-y-8">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-300">Nib static sites</p>
      <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-7xl">Static TSX with interactive React islands.</h1>
      <p className="max-w-2xl text-lg text-slate-300">Pages render to static HTML. Only explicit islands hydrate in the browser.</p>
      <Counter initialCount={0} hydrate="load" />
    </section>
  )
}
