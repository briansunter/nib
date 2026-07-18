import type { PageMeta } from '../../framework/types'

export const meta: PageMeta = {
  title: 'Not found',
  description: 'The requested page does not exist.'
}

export default function NotFoundPage() {
  return <section><p className="text-sm text-sky-300">404</p><h1 className="mt-3 text-5xl font-bold">Page not found</h1></section>
}
