import { siteHref, type PageMeta } from '@briansunter/nib'

export const meta: PageMeta = {
  title: 'Not found',
  description: 'The requested page does not exist.'
}

export default function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="not-found__eyebrow">404 · Route missing</p>
      <h1>This page wasn’t built.</h1>
      <p className="not-found__lede">
        The address may have changed, or the route may no longer exist.
        Start again from the docs or return home.
      </p>
      <div className="not-found__actions">
        <a className="button button--primary" href={siteHref('/docs/')}>Browse the docs <span aria-hidden="true">→</span></a>
        <a className="button button--quiet" href={siteHref('/')}>Back home</a>
      </div>
    </section>
  )
}
