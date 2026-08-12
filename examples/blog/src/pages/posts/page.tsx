import { definePage, siteHref } from '@briansunter/nib'
import type config from '../../../nib.config'

export const meta = {
  title: 'Posts',
  description: 'Every field note in the fictional Commonplace journal.',
}

export default definePage<typeof config>(function PostsPage({ collections }) {
  return (
    <section className="archive">
      <p className="eyebrow">The notebook</p>
      <h1>All field notes</h1>
      <p className="lede">Small essays about creative practice, attention, and everyday experiments.</p>
      <ol className="archive-list">
        {collections.posts.map(({ id, data }) => (
          <li key={id}>
            <time dateTime={data.date}>{data.date}</time>
            <div>
              <h2>
                <a href={siteHref(data.path)}>
                  {data.title}
                </a>
              </h2>
              <p>{data.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
})
