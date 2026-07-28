import { defineDataPage, siteHref } from '@briansunter/nib'
import type { Topic } from './content'

export const TopicPage = defineDataPage<Topic>(function TopicPage({ data }) {
  return (
    <article className="topic-page">
      <p className="eyebrow">Topic guide</p>
      <h1>{data.title}</h1>
      <p className="lede">{data.description}</p>
      <a className="text-link" href={siteHref('/posts/')}>
        Browse all field notes <span aria-hidden="true">→</span>
      </a>
    </article>
  )
})
