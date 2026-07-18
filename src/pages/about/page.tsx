import type { PageMeta } from '../../framework/types'

export const meta: PageMeta = {
  title: 'About',
  description: 'How Nib works.'
}

export default function AboutPage() {
  return <article className="prose prose-invert"><h1>About</h1><p>This is a normal TypeScript React page discovered from its folder.</p></article>
}
