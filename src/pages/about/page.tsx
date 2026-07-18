import type { PageMeta } from '../../framework/types'

export const meta: PageMeta = {
  title: 'About',
  description: 'How Nib works.'
}

export default function AboutPage() {
  return <article className="prose prose-invert"><h1>About</h1><p>This TSX page is discovered from its folder and prerendered to static HTML.</p></article>
}
