import { siteHref } from '@briansunter/nib'

export function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {href && linkLabel && <a href={siteHref(href)}>{linkLabel} →</a>}
    </div>
  )
}
