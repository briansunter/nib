import type { DataPageProps } from '@briansunter/nib'
import { z } from '@briansunter/nib'

export const teamMemberSchema = z.object({
  name: z.string(),
  role: z.string(),
})

export function TeamMemberPage({
  data,
}: DataPageProps<z.infer<typeof teamMemberSchema>>) {
  return <h1>{data.name}, {data.role}</h1>
}

export const productSchema = z.object({
  slug: z.string(),
  name: z.string(),
  price: z.coerce.number(),
})

export function ProductPage({
  data,
}: DataPageProps<z.infer<typeof productSchema>>) {
  return (
    <article>
      <h1>{data.name}</h1>
      <p>${data.price}</p>
    </article>
  )
}
