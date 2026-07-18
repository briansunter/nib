import type { ReactNode } from 'react'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <p className="mb-6 text-sm font-medium uppercase tracking-[0.25em] text-sky-300">Documentation</p>
      {children}
    </div>
  )
}
