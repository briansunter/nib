import type { ReactNode } from 'react'

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-3 lg:px-8">
      {children}
    </div>
  )
}
