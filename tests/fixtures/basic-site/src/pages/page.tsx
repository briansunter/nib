import type { PageProps } from '@briansunter/nib'
import type config from '../../nib.config'

export const meta = {
  title: 'Home',
  description: 'Journal home.',
}

export default function HomePage({ collections }: PageProps<typeof config>) {
  return (
    <>
      <h1>Journal home</h1>
      <p>{collections.posts[0].data.title}</p>
      <time>{collections.posts[0].data.published.toISOString()}</time>
      <button type="button">Count: 2</button>
    </>
  )
}
