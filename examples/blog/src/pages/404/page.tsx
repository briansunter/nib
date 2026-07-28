import { siteHref, type PageMeta } from '@briansunter/nib'

export const meta = {
  title: 'Page not found',
  description: 'That Commonplace page does not exist.',
} satisfies PageMeta

export default function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="eyebrow">404</p>
      <h1>That note wandered off.</h1>
      <a className="text-link" href={siteHref('/')}>Return home →</a>
    </section>
  )
}
