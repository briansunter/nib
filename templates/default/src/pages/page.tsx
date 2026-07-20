import { Counter } from '../islands/counter'
import { definePage, siteHref, type PageMeta } from '@briansunter/nib'

export const meta = {
  title: 'Home',
  description: 'A new Nib site.',
} satisfies PageMeta

export default definePage(function HomePage() {
  return (
    <>
      <p className="eyebrow">Nib</p>
      <h1>Make a site.<br />Keep it light.</h1>
      <p>Write pages in TSX, Markdown, or a configured data format. Nib prerenders the result, and only explicit islands ship browser JavaScript.</p>
      <a className="button" href={siteHref('/about/')}>See how it works <span aria-hidden="true">→</span></a>
      <Counter initialCount={0} />
    </>
  )
})
