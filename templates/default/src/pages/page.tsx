import { Counter } from '../islands/counter'
import type { PageMeta } from '@briansunter/nib'

export const meta = {
  title: 'Home',
  description: 'A new Nib site.',
} satisfies PageMeta

export default function HomePage() {
  return (
    <>
      <p className="eyebrow">Nib</p>
      <h1>Make this site yours.</h1>
      <p>Pages are prerendered. Only explicit islands ship browser JavaScript.</p>
      <Counter initialCount={0} />
    </>
  )
}
