import { useState } from 'react'
import type { PageMeta } from '../framework/types'

export const meta: PageMeta = {
  title: 'Home',
  description: 'A tiny file-routed static-site generator.'
}

export default function HomePage() {
  const [count, setCount] = useState(0)
  return (
    <section className="space-y-8">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-300">Mini framework</p>
      <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-7xl">React pages and Markdown, routed by folders.</h1>
      <p className="max-w-2xl text-lg text-slate-300">Every page is SSR-rendered at build time and hydrated in the browser.</p>
      <button className="rounded-lg bg-white px-4 py-2 font-medium text-slate-950" onClick={() => setCount((value) => value + 1)}>
        Count: {count}
      </button>
    </section>
  )
}
