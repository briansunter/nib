import type { PageMeta } from '@briansunter/nib'

export const meta = {
  title: 'Not found',
  description: 'The requested page does not exist.',
} satisfies PageMeta

export default function NotFoundPage() {
  return <h1>Not found</h1>
}
