import type { ReactNode } from 'react'

export function PageHero({
  title,
  titleNode,
  before,
  children,
  className,
}: {
  title?: string
  titleNode?: ReactNode
  before?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={['page-hero', className].filter(Boolean).join(' ')}>
      {before}
      <h1 className="page-hero-title">{titleNode ?? title}</h1>
      <div className="page-hero-rule" aria-hidden="true" />
      <p className="page-hero-dek">{children}</p>
    </header>
  )
}
